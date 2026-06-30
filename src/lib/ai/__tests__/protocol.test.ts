import { describe, it, expect } from 'vitest';
import {
  endpoint,
  buildHeaders,
  buildToolsParam,
  extractAssistantTurn,
  echoAssistantMessage,
  buildToolResultMessage,
  buildAgentBody,
} from '../protocol';

describe('endpoint', () => {
  it('uses chat/completions for openai protocol', () => {
    expect(endpoint('openai')).toBe('chat/completions');
  });

  it('uses messages for anthropic protocol', () => {
    expect(endpoint('anthropic')).toBe('messages');
  });
});

describe('buildHeaders', () => {
  it('sends bearer auth for openai protocol', () => {
    const headers = buildHeaders('openai', 'sk-test');
    expect(headers.Authorization).toBe('Bearer sk-test');
  });

  it('sends x-api-key and direct-browser header for anthropic', () => {
    const headers = buildHeaders('anthropic', 'sk-ant');
    expect(headers['x-api-key']).toBe('sk-ant');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });
});

const specs = [{ name: 'create_task', description: 'd', inputSchema: { type: 'object' } }];

describe('buildToolsParam', () => {
  it('wraps specs as function tools for openai', () => {
    const tools = buildToolsParam('openai', specs);
    expect(tools[0]).toEqual({
      type: 'function',
      function: { name: 'create_task', description: 'd', parameters: { type: 'object' } },
    });
  });

  it('uses input_schema for anthropic', () => {
    const tools = buildToolsParam('anthropic', specs);
    expect(tools[0]).toEqual({
      name: 'create_task',
      description: 'd',
      input_schema: { type: 'object' },
    });
  });
});

describe('extractAssistantTurn', () => {
  it('extracts text and tool calls from an openai message', () => {
    const body = {
      choices: [
        {
          message: {
            content: 'ok',
            reasoning_content: 'thinking',
            tool_calls: [
              { id: 't1', function: { name: 'create_task', arguments: '{"title":"x"}' } },
            ],
          },
        },
      ],
    };
    const turn = extractAssistantTurn('openai', body);
    expect(turn.text).toBe('ok');
    expect(turn.reasoning).toBe('thinking');
    expect(turn.toolCalls).toEqual([{ id: 't1', name: 'create_task', args: { title: 'x' } }]);
  });

  it('extracts text and tool_use blocks from anthropic', () => {
    const body = {
      content: [
        { type: 'thinking', thinking: 'musing' },
        { type: 'text', text: 'hi' },
        { type: 'tool_use', id: 'u1', name: 'list_tasks', input: { status: 'TODO' } },
      ],
    };
    const turn = extractAssistantTurn('anthropic', body);
    expect(turn.text).toBe('hi');
    expect(turn.reasoning).toBe('musing');
    expect(turn.toolCalls).toEqual([{ id: 'u1', name: 'list_tasks', args: { status: 'TODO' } }]);
  });

  it('returns empty tool calls when none present', () => {
    expect(
      extractAssistantTurn('openai', { choices: [{ message: { content: 'hi' } }] }).toolCalls,
    ).toEqual([]);
  });
});

describe('echoAssistantMessage', () => {
  it('returns the openai assistant message verbatim', () => {
    const body = { choices: [{ message: { role: 'assistant', content: 'hi' } }] };
    expect(echoAssistantMessage('openai', body)).toEqual({ role: 'assistant', content: 'hi' });
  });

  it('returns an assistant content-block message for anthropic', () => {
    const body = { content: [{ type: 'text', text: 'hi' }] };
    expect(echoAssistantMessage('anthropic', body)).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
    });
  });
});

describe('buildToolResultMessage', () => {
  const call = { id: 't1', name: 'create_task', args: {} };

  it('builds a tool-role message for openai', () => {
    const msg = buildToolResultMessage('openai', call, { ok: true });
    expect(msg.role).toBe('tool');
    expect(msg.tool_call_id).toBe('t1');
    expect(msg.content).toBe(JSON.stringify({ ok: true }));
  });

  it('builds a tool_result user message for anthropic', () => {
    const msg = buildToolResultMessage('anthropic', call, { ok: true });
    expect(msg.role).toBe('user');
    expect((msg.content as any[])[0].tool_use_id).toBe('t1');
  });
});

describe('buildAgentBody', () => {
  it('prepends system and adds tool_choice for openai', () => {
    const body = buildAgentBody('openai', {
      model: 'm',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function' }],
      stream: false,
    });
    expect((body as any).messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect((body as any).stream).toBe(false);
    expect((body as any).tool_choice).toBe('auto');
  });

  it('lifts system to top-level for anthropic', () => {
    const body = buildAgentBody('anthropic', {
      model: 'm',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });
    expect((body as any).system).toBe('sys');
    expect((body as any).max_tokens).toBe(4096);
    expect((body as any).messages[0].role).toBe('user');
  });
});
