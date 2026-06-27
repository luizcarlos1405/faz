import type { Protocol } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  if (protocol === 'anthropic') {
    const rest = [...messages];
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
  return { model, messages, stream: true };
}

export function isDoneMarker(data: string): boolean {
  return data === '[DONE]';
}

export function parseOpenAIDelta(parsed: Record<string, any>): { text: string; done: boolean } {
  const choice = parsed.choices?.[0];
  const text = typeof choice?.delta?.content === 'string' ? choice.delta.content : '';
  return { text, done: false };
}

export function parseAnthropicDelta(parsed: Record<string, any>): { text: string; done: boolean } {
  if (parsed.type === 'content_block_delta') {
    const text = typeof parsed.delta?.text === 'string' ? parsed.delta.text : '';
    return { text, done: false };
  }
  if (parsed.type === 'message_stop') {
    return { text: '', done: true };
  }
  return { text: '', done: false };
}

export function parseDataPayload(
  protocol: Protocol,
  data: string,
): { text: string; done: boolean } | null {
  if (isDoneMarker(data)) {
    return { text: '', done: true };
  }
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  return protocol === 'anthropic' ? parseAnthropicDelta(parsed) : parseOpenAIDelta(parsed);
}
