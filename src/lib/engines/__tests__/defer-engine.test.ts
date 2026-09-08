import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  isDeferred,
  partitionDeferred,
  doAfterFromTime,
  isFutureTime,
  timeOfDay,
  nextRoundedTime,
  withDoAt,
  withDoAfter,
  msUntilNextMinute,
} from '../defer-engine';
import { DOC_TYPE, TASK_STATUS, type TaskDoc } from '$lib/types';

function task(overrides: Partial<TaskDoc> = {}): TaskDoc {
  return {
    _id: `task_${overrides.title ?? 'x'}`,
    type: DOC_TYPE.TASK.value,
    title: 'x',
    doAt: '2026-09-08',
    status: TASK_STATUS.TODO.value,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

const NOW = Temporal.Instant.from('2026-09-08T12:00:00Z');

describe('isDeferred', () => {
  it('is false when doAfter is absent', () => {
    expect(isDeferred(task(), NOW)).toBe(false);
  });

  it('is false when doAfter is malformed', () => {
    expect(isDeferred(task({ doAfter: 'not-a-date' }), NOW)).toBe(false);
  });

  it('is true when now is before doAfter', () => {
    expect(isDeferred(task({ doAfter: '2026-09-08T12:00:01Z' }), NOW)).toBe(true);
  });

  it('is false when now equals doAfter', () => {
    expect(isDeferred(task({ doAfter: '2026-09-08T12:00:00Z' }), NOW)).toBe(false);
  });

  it('is false when doAfter has passed', () => {
    expect(isDeferred(task({ doAfter: '2026-09-08T11:59:59Z' }), NOW)).toBe(false);
  });
});

describe('partitionDeferred', () => {
  it('splits ready and deferred and sorts ready by list order', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 2 }),
      task({ title: 'b', tasksListOrder: 0, doAfter: '2026-09-08T15:00:00Z' }),
      task({ title: 'c', tasksListOrder: 1 }),
      task({ title: 'd', tasksListOrder: 3, doAfter: '2026-09-08T13:00:00Z' }),
    ];
    const { ready, deferred } = partitionDeferred(tasks, NOW);
    expect(ready.map((t) => t.title)).toEqual(['c', 'a']);
    expect(deferred.map((t) => t.title)).toEqual(['d', 'b']);
  });

  it('treats passed doAfter as ready', () => {
    const tasks = [task({ title: 'a', doAfter: '2026-09-08T11:00:00Z', tasksListOrder: 0 })];
    const { ready, deferred } = partitionDeferred(tasks, NOW);
    expect(ready).toHaveLength(1);
    expect(deferred).toHaveLength(0);
  });

  it('breaks doAfter ties by list order', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 5, doAfter: '2026-09-08T13:00:00Z' }),
      task({ title: 'b', tasksListOrder: 1, doAfter: '2026-09-08T13:00:00Z' }),
    ];
    const { deferred } = partitionDeferred(tasks, NOW);
    expect(deferred.map((t) => t.title)).toEqual(['b', 'a']);
  });

  it('does not mutate the input', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 1 }),
      task({ title: 'b', tasksListOrder: 0 }),
    ];
    partitionDeferred(tasks, NOW);
    expect(tasks.map((t) => t.title)).toEqual(['a', 'b']);
  });
});

describe('doAfterFromTime', () => {
  it('builds an instant for the given local time in UTC', () => {
    expect(doAfterFromTime(Temporal.PlainDate.from('2026-09-08'), 9, 30, 'UTC')).toBe(
      '2026-09-08T09:30:00Z',
    );
  });

  it('respects the time zone offset', () => {
    expect(doAfterFromTime(Temporal.PlainDate.from('2026-09-08'), 9, 30, 'America/Sao_Paulo')).toBe(
      '2026-09-08T12:30:00Z',
    );
  });

  it('handles DST transitions', () => {
    expect(doAfterFromTime(Temporal.PlainDate.from('2026-03-29'), 12, 0, 'Europe/Berlin')).toBe(
      '2026-03-29T10:00:00Z',
    );
    expect(doAfterFromTime(Temporal.PlainDate.from('2026-03-28'), 12, 0, 'Europe/Berlin')).toBe(
      '2026-03-28T11:00:00Z',
    );
  });

  it('round-trips through timeOfDay', () => {
    const iso = doAfterFromTime(Temporal.PlainDate.from('2026-09-08'), 23, 45, 'Asia/Tokyo');
    expect(timeOfDay(iso, 'Asia/Tokyo')).toEqual({ hour: 23, minute: 45 });
  });
});

describe('isFutureTime', () => {
  it('is true strictly after now', () => {
    expect(isFutureTime('2026-09-08T12:00:01Z', NOW)).toBe(true);
  });

  it('is false at or before now', () => {
    expect(isFutureTime('2026-09-08T12:00:00Z', NOW)).toBe(false);
    expect(isFutureTime('2026-09-08T11:00:00Z', NOW)).toBe(false);
  });

  it('is false for malformed input', () => {
    expect(isFutureTime('nope', NOW)).toBe(false);
  });
});

describe('nextRoundedTime', () => {
  it('rounds up to the next step', () => {
    expect(nextRoundedTime(Temporal.Instant.from('2026-09-08T09:32:10Z'), 'UTC')).toEqual({
      hour: 9,
      minute: 35,
    });
  });

  it('moves a full step when already on a boundary', () => {
    expect(nextRoundedTime(Temporal.Instant.from('2026-09-08T09:35:00Z'), 'UTC')).toEqual({
      hour: 9,
      minute: 40,
    });
  });

  it('wraps past midnight in local time', () => {
    expect(nextRoundedTime(Temporal.Instant.from('2026-09-08T23:58:00Z'), 'UTC')).toEqual({
      hour: 0,
      minute: 0,
    });
  });
});

describe('withDoAt', () => {
  it('clears doAfter when the date changes', () => {
    const t = task({ doAfter: '2026-09-08T15:00:00Z' });
    const next = withDoAt(t, '2026-09-09');
    expect(next.doAt).toBe('2026-09-09');
    expect(next.doAfter).toBeUndefined();
    expect(t.doAfter).toBe('2026-09-08T15:00:00Z');
  });

  it('keeps doAfter when the date is unchanged', () => {
    const t = task({ doAfter: '2026-09-08T15:00:00Z' });
    const next = withDoAt(t, '2026-09-08');
    expect(next.doAfter).toBe('2026-09-08T15:00:00Z');
    expect(next).not.toBe(t);
  });
});

describe('withDoAfter', () => {
  it('sets doAfter', () => {
    expect(withDoAfter(task(), '2026-09-08T15:00:00Z').doAfter).toBe('2026-09-08T15:00:00Z');
  });

  it('removes doAfter for null and undefined', () => {
    const t = task({ doAfter: '2026-09-08T15:00:00Z' });
    expect('doAfter' in withDoAfter(t, null)).toBe(false);
    expect('doAfter' in withDoAfter(t, undefined)).toBe(false);
    expect(t.doAfter).toBeDefined();
  });
});

describe('msUntilNextMinute', () => {
  it('returns a full minute on the boundary', () => {
    expect(msUntilNextMinute(Temporal.Instant.from('2026-09-08T12:00:00Z'))).toBe(60_000);
  });

  it('returns the remainder mid-minute', () => {
    expect(msUntilNextMinute(Temporal.Instant.from('2026-09-08T12:00:59.500Z'))).toBe(500);
  });
});
