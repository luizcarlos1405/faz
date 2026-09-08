import { describe, it, expect } from 'vitest';
import { buildBasePrompt, buildSystemContext, type AgentContext } from '../context';

const emptyCtx: AgentContext = {
  today: '2026-06-29',
  tasks: [],
  goals: [],
  cares: [],
  inboxCount: 0,
};

describe('buildBasePrompt', () => {
  const prompt = buildBasePrompt('2026-06-29');

  it('names Faz as a personal organization app and injects today', () => {
    expect(prompt).toContain('personal organization app');
    expect(prompt).toContain('Today is 2026-06-29');
  });

  it('describes the four kinds of things in Faz', () => {
    expect(prompt).toContain('Tasks:');
    expect(prompt).toContain('Goals:');
    expect(prompt).toContain('Cares:');
    expect(prompt).toContain('Inbox:');
  });

  it('instructs capture-to-inbox for passing thoughts', () => {
    expect(prompt).toContain('create_inbox_item');
    expect(prompt).toMatch(/capture it with create_inbox_item/i);
  });

  it('frames Faz as a thinking partner, not a command runner', () => {
    expect(prompt).toMatch(/thinking partner/i);
    expect(prompt).toMatch(/not just a command runner/i);
  });

  it('still acts once the intent is clear', () => {
    expect(prompt).toMatch(/Once the intent is clear, act/i);
  });

  it('instructs asking a clarifying question and waiting when ambiguous', () => {
    expect(prompt).toMatch(/ask a short clarifying question/i);
    expect(prompt).toMatch(/stop and wait/i);
    expect(prompt).toMatch(/Don't guess or assume/);
    expect(prompt).toMatch(/ambiguous, incomplete, or something about it sounds strange/);
  });

  it('demands HTML replies, never markdown', () => {
    expect(prompt).toMatch(/Always reply with HTML, never markdown/);
    expect(prompt).not.toContain('**bold** as encouraged');
  });
});

describe('buildSystemContext', () => {
  it('appends the live snapshot to the base prompt', () => {
    const ctx: AgentContext = {
      today: '2026-06-29',
      tasks: [{ id: 't1', title: 'Pay rent', doAt: '2026-06-29', status: 'TODO' }],
      goals: [{ id: 'g1', title: 'Move house', status: 'IN_PROGRESS' }],
      cares: [{ id: 'c1', title: 'Hydrate', planCount: 1 }],
      inboxCount: 3,
    };
    const out = buildSystemContext(ctx);

    expect(out).toContain('personal organization app');
    expect(out).toContain('Active tasks (due today or earlier, 1):');
    expect(out).toContain('Pay rent (id t1, due 2026-06-29, TODO)');
    expect(out).toContain('Move house (id g1, IN_PROGRESS)');
    expect(out).toContain('Hydrate (id c1, 1 recurring plan(s))');
    expect(out).toContain('Inbox: 3 unprocessed item(s).');
  });

  it('marks tasks hidden until a time', () => {
    const ctx: AgentContext = {
      ...emptyCtx,
      tasks: [
        {
          id: 't1',
          title: 'Call mom',
          doAt: '2026-06-29',
          status: 'TODO',
          doAfter: '2026-06-29T18:00:00Z',
        },
      ],
    };
    const out = buildSystemContext(ctx);
    expect(out).toContain(
      'Call mom (id t1, due 2026-06-29, TODO, hidden until 2026-06-29T18:00:00Z)',
    );
  });

  it('explains the hide-until time in the base prompt', () => {
    expect(buildBasePrompt('2026-06-29')).toContain('doAfterTime');
  });

  it('shows (none) placeholders for empty sections', () => {
    const out = buildSystemContext(emptyCtx);
    expect(out).toContain('Active tasks (due today or earlier, 0):');
    expect(out).toContain('- (none)');
    expect(out).toContain('Inbox: 0 unprocessed item(s).');
  });
});
