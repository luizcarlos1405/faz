import { getProvider, type ProviderId } from './providers';
import {
  endpoint,
  buildHeaders,
  buildAgentBody,
  buildToolsParam,
  extractAssistantTurn,
  echoAssistantMessage,
  buildToolResultMessage,
  type ChatMessage,
} from './protocol';
import { ChatError, assertOk } from './client';
import { executeTool, type ToolUndo } from './tools/registry';
import { TOOL_SPECS } from './tools/specs';

const MAX_ITERATIONS = 8;
const LIMIT_MESSAGE = 'I reached the action limit for one request — try narrowing it down.';

export interface ToolEvent {
  id: string;
  name: string;
  label: string;
  ok: boolean;
  undo?: ToolUndo;
}

export interface RunAgentOptions {
  providerId: ProviderId;
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onReasoning?: (text: string) => void;
  onTool?: (event: ToolEvent) => void;
  onText?: (text: string) => void;
}

export async function runAgent(
  opts: RunAgentOptions,
): Promise<{ text: string; reasoning: string }> {
  const provider = getProvider(opts.providerId);
  const tools = buildToolsParam(provider.protocol, TOOL_SPECS);
  const url = `${provider.baseUrl}/${endpoint(provider.protocol)}`;
  const headers = {
    ...buildHeaders(provider.protocol, opts.apiKey),
    'Content-Type': 'application/json',
  };

  const conversation: Record<string, any>[] = opts.messages
    .filter((m) => !m.error && m.content !== undefined)
    .map((m) => ({ role: m.role, content: m.content }));

  let reasoning = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const body = JSON.stringify(
      buildAgentBody(provider.protocol, {
        model: opts.model,
        system: opts.system,
        messages: conversation,
        tools,
        stream: false,
      }),
    );

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body, signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      if (e instanceof TypeError) {
        if (!provider.browserCompatible) {
          throw new ChatError(
            'cors',
            `${provider.label} does not allow requests from a web browser. Try Zhipu GLM or Anthropic.`,
          );
        }
        throw new ChatError('network', `Could not reach ${provider.label}. Check your connection.`);
      }
      throw e;
    }
    assertOk(response, provider);

    const data = await response.json();
    const turn = extractAssistantTurn(provider.protocol, data);
    if (turn.reasoning) {
      reasoning += turn.reasoning;
      opts.onReasoning?.(turn.reasoning);
    }

    if (turn.toolCalls.length === 0) {
      opts.onText?.(turn.text);
      return { text: turn.text, reasoning };
    }

    conversation.push(echoAssistantMessage(provider.protocol, data));
    for (const call of turn.toolCalls) {
      const result = await executeTool(call.name, call.args);
      opts.onTool?.({
        id: call.id,
        name: call.name,
        label: result.label,
        ok: result.ok,
        undo: result.undo,
      });
      conversation.push(buildToolResultMessage(provider.protocol, call, result.summary));
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }
  }

  opts.onText?.(LIMIT_MESSAGE);
  return { text: '', reasoning };
}
