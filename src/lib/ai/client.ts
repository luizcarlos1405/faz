import { getProvider, type ProviderId } from './providers';
import { endpoint, buildHeaders, buildBody, parseDataPayload, type ChatMessage } from './protocol';

export type { ChatMessage } from './protocol';

export type ChatErrorKind = 'auth' | 'rate' | 'cors' | 'network' | 'http';

export class ChatError extends Error {
  kind: ChatErrorKind;
  status?: number;
  constructor(kind: ChatErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ChatError';
    this.kind = kind;
    this.status = status;
  }
}

export interface StreamChatOptions {
  providerId: ProviderId;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const provider = getProvider(opts.providerId);
  const url = `${provider.baseUrl}/${endpoint(provider.protocol)}`;
  const headers = {
    ...buildHeaders(provider.protocol, opts.apiKey),
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify(buildBody(provider.protocol, opts.messages, opts.model));

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body, signal: opts.signal });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    if (e instanceof TypeError) {
      if (!provider.browserCompatible) {
        throw new ChatError(
          'cors',
          `${provider.label} does not allow requests from a web browser. Try a browser-compatible provider like Zhipu GLM or Anthropic.`,
        );
      }
      throw new ChatError('network', `Could not reach ${provider.label}. Check your connection.`);
    }
    throw e;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ChatError('auth', `Invalid API key for ${provider.label}.`);
    }
    if (response.status === 429) {
      throw new ChatError('rate', `${provider.label} is rate limiting. Try again shortly.`);
    }
    throw new ChatError(
      'http',
      `${provider.label} returned an error (${response.status}).`,
      response.status,
    );
  }

  if (!response.body) {
    throw new ChatError('network', `No response stream from ${provider.label}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        const result = parseDataPayload(provider.protocol, data);
        if (!result) continue;
        if (result.text) opts.onDelta(result.text);
        if (result.done) return;
      }
    }
  } finally {
    try {
      reader.cancel();
    } catch {
      // reader already released or errored
    }
  }
}
