import type { Protocol } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning?: string;
  error?: boolean;
}

export interface StreamDelta {
  content: string;
  reasoning: string;
  done: boolean;
}

const ANTHROPIC_MAX_TOKENS = 4096;

export function endpoint(protocol: Protocol): string {
  return protocol === 'anthropic' ? 'messages' : 'chat/completions';
}

export function buildHeaders(protocol: Protocol, apiKey: string): Record<string, string> {
  if (protocol === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

export function buildBody(
  protocol: Protocol,
  messages: ChatMessage[],
  model: string,
): Record<string, unknown> {
  // Only role/content are part of the request — reasoning/error are UI-only.
  const clean = messages.map((m) => ({ role: m.role, content: m.content }));
  if (protocol === 'anthropic') {
    const rest = [...clean];
    let system: string | undefined;
    if (rest[0]?.role === 'system') {
      system = rest.shift()!.content;
    }
    const body: Record<string, unknown> = {
      model,
      messages: rest,
      stream: true,
      max_tokens: ANTHROPIC_MAX_TOKENS,
    };
    if (system) body.system = system;
    return body;
  }
  return { model, messages: clean, stream: true };
}

export function isDoneMarker(data: string): boolean {
  return data === '[DONE]';
}

export function parseOpenAIDelta(parsed: Record<string, any>): StreamDelta {
  const delta = parsed.choices?.[0]?.delta;
  const content = typeof delta?.content === 'string' ? delta.content : '';
  const reasoning = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : '';
  return { content, reasoning, done: false };
}

export function parseAnthropicDelta(parsed: Record<string, any>): StreamDelta {
  if (parsed.type === 'content_block_delta') {
    const delta = parsed.delta;
    if (delta?.type === 'thinking_delta') {
      return { content: '', reasoning: delta.thinking ?? '', done: false };
    }
    return {
      content: typeof delta?.text === 'string' ? delta.text : '',
      reasoning: '',
      done: false,
    };
  }
  if (parsed.type === 'message_stop') {
    return { content: '', reasoning: '', done: true };
  }
  return { content: '', reasoning: '', done: false };
}

export function parseDataPayload(protocol: Protocol, data: string): StreamDelta | null {
  if (isDoneMarker(data)) {
    return { content: '', reasoning: '', done: true };
  }
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  return protocol === 'anthropic' ? parseAnthropicDelta(parsed) : parseOpenAIDelta(parsed);
}
