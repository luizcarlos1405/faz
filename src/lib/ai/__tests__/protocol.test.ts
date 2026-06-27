import { describe, it, expect } from 'vitest';
import {
  endpoint,
  buildHeaders,
  buildBody,
  isDoneMarker,
  parseOpenAIDelta,
  parseAnthropicDelta,
  parseDataPayload,
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

describe('buildBody', () => {
  const messages = [{ role: 'user' as const, content: 'hi' }];

  it('streams without max_tokens for openai', () => {
    expect(buildBody('openai', messages, 'glm-4.7-flash')).toEqual({
      model: 'glm-4.7-flash',
      messages,
      stream: true,
    });
  });

  it('includes max_tokens for anthropic', () => {
    const body = buildBody('anthropic', messages, 'claude-3');
    expect(body.max_tokens).toBe(4096);
    expect(body.stream).toBe(true);
  });

  it('lifts a leading system message into the system field for anthropic', () => {
    const withSystem = [
      { role: 'system' as const, content: 'be brief' },
      { role: 'user' as const, content: 'hi' },
    ];
    const body = buildBody('anthropic', withSystem, 'claude-3');
    expect(body.system).toBe('be brief');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('keeps system message inline for openai protocol', () => {
    const withSystem = [
      { role: 'system' as const, content: 'be brief' },
      { role: 'user' as const, content: 'hi' },
    ];
    expect(buildBody('openai', withSystem, 'glm-4.7-flash').messages).toEqual(withSystem);
  });
});

describe('parseOpenAIDelta', () => {
  it('extracts content text', () => {
    const parsed = { choices: [{ delta: { content: 'Hello' } }] };
    expect(parseOpenAIDelta(parsed)).toEqual({ text: 'Hello', done: false });
  });

  it('returns empty text when no content', () => {
    const parsed = { choices: [{ delta: { role: 'assistant' } }] };
    expect(parseOpenAIDelta(parsed).text).toBe('');
  });
});

describe('parseAnthropicDelta', () => {
  it('extracts text from content_block_delta', () => {
    const parsed = { type: 'content_block_delta', delta: { text: 'Hi' } };
    expect(parseAnthropicDelta(parsed)).toEqual({ text: 'Hi', done: false });
  });

  it('signals done on message_stop', () => {
    expect(parseAnthropicDelta({ type: 'message_stop' }).done).toBe(true);
  });

  it('ignores other event types', () => {
    expect(parseAnthropicDelta({ type: 'message_start' })).toEqual({ text: '', done: false });
  });
});

describe('parseDataPayload', () => {
  it('handles the [DONE] marker', () => {
    expect(parseDataPayload('openai', '[DONE]')).toEqual({ text: '', done: true });
  });

  it('returns null on invalid JSON', () => {
    expect(parseDataPayload('openai', 'not json')).toBeNull();
  });

  it('parses an openai content chunk', () => {
    const data = JSON.stringify({ choices: [{ delta: { content: 'x' } }] });
    expect(parseDataPayload('openai', data)).toEqual({ text: 'x', done: false });
  });

  it('parses an anthropic content chunk', () => {
    const data = JSON.stringify({ type: 'content_block_delta', delta: { text: 'y' } });
    expect(parseDataPayload('anthropic', data)).toEqual({ text: 'y', done: false });
  });
});

describe('isDoneMarker', () => {
  it('matches the done marker exactly', () => {
    expect(isDoneMarker('[DONE]')).toBe(true);
    expect(isDoneMarker('{"foo":1}')).toBe(false);
  });
});
