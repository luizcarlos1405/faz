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

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface AssistantTurn {
  text: string;
  reasoning: string;
  toolCalls: ToolCall[];
}

export interface ToolSpecLike {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function safeParseArgs(raw: unknown): Record<string, any> {
  if (raw && typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string') return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, any>) : {};
  } catch {
    return {};
  }
}

export function buildToolsParam(protocol: Protocol, specs: ToolSpecLike[]): unknown[] {
  if (protocol === 'anthropic') {
    return specs.map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.inputSchema,
    }));
  }
  return specs.map((s) => ({
    type: 'function',
    function: { name: s.name, description: s.description, parameters: s.inputSchema },
  }));
}

export function extractAssistantTurn(protocol: Protocol, body: Record<string, any>): AssistantTurn {
  if (protocol === 'anthropic') {
    const blocks: any[] = body.content ?? [];
    const text = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    const reasoning = blocks
      .filter((b) => b.type === 'thinking')
      .map((b) => b.thinking ?? '')
      .join('');
    const toolCalls: ToolCall[] = blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} }));
    return { text, reasoning, toolCalls };
  }
  const msg = body.choices?.[0]?.message ?? {};
  const text = typeof msg.content === 'string' ? msg.content : '';
  const reasoning = typeof msg.reasoning_content === 'string' ? msg.reasoning_content : '';
  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc: any) => ({
    id: tc.id,
    name: tc.function?.name,
    args: safeParseArgs(tc.function?.arguments),
  }));
  return { text, reasoning, toolCalls };
}

export function echoAssistantMessage(
  protocol: Protocol,
  body: Record<string, any>,
): Record<string, any> {
  if (protocol === 'anthropic') {
    return { role: 'assistant', content: body.content ?? [] };
  }
  return body.choices?.[0]?.message ?? { role: 'assistant', content: '' };
}

export function buildToolResultMessage(
  protocol: Protocol,
  call: ToolCall,
  summary: unknown,
): Record<string, any> {
  const text = JSON.stringify(summary);
  if (protocol === 'anthropic') {
    return {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: call.id, content: text }],
    };
  }
  return { role: 'tool', tool_call_id: call.id, content: text };
}

export function buildAgentBody(
  protocol: Protocol,
  opts: {
    model: string;
    system: string;
    messages: Record<string, any>[];
    tools?: unknown[];
    stream: boolean;
  },
): Record<string, unknown> {
  if (protocol === 'anthropic') {
    const body: Record<string, unknown> = {
      model: opts.model,
      system: opts.system,
      messages: opts.messages,
      stream: opts.stream,
      max_tokens: ANTHROPIC_MAX_TOKENS,
    };
    if (opts.tools?.length) body.tools = opts.tools;
    return body;
  }
  const messages = [{ role: 'system', content: opts.system }, ...opts.messages];
  const body: Record<string, unknown> = { model: opts.model, messages, stream: opts.stream };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = 'auto';
  }
  return body;
}
