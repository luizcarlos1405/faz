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
  it('splits ready and later today and sorts ready by list order', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 2 }),
      task({ title: 'b', tasksListOrder: 0, doAfter: '2026-09-08T15:00:00Z' }),
      task({ title: 'c', tasksListOrder: 1 }),
      task({ title: 'd', tasksListOrder: 3, doAfter: '2026-09-08T13:00:00Z' }),
    ];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(ready.map((t) => t.title)).toEqual(['c', 'a']);
    expect(laterToday.map((t) => t.title)).toEqual(['d', 'b']);
    expect(future).toHaveLength(0);
  });

  it('treats passed doAfter as ready', () => {
    const tasks = [task({ title: 'a', doAfter: '2026-09-08T11:00:00Z', tasksListOrder: 0 })];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(ready).toHaveLength(1);
    expect(laterToday).toHaveLength(0);
    expect(future).toHaveLength(0);
  });

  it('breaks doAfter ties by list order', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 5, doAfter: '2026-09-08T13:00:00Z' }),
      task({ title: 'b', tasksListOrder: 1, doAfter: '2026-09-08T13:00:00Z' }),
    ];
    const { laterToday } = partitionDeferred(tasks, NOW, 'UTC');
    expect(laterToday.map((t) => t.title)).toEqual(['b', 'a']);
  });

  it('puts tasks dated beyond today in future even without doAfter', () => {
    const tasks = [
      task({ title: 'a', doAt: '2026-09-09', tasksListOrder: 1 }),
      task({ title: 'b', doAt: '2026-09-10', tasksListOrder: 0 }),
    ];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(future.map((t) => t.title)).toEqual(['a', 'b']);
    expect(ready).toHaveLength(0);
    expect(laterToday).toHaveLength(0);
  });

  it('puts future-dated tasks in future even when doAfter has passed', () => {
    const tasks = [task({ title: 'a', doAt: '2026-09-09', doAfter: '2026-09-08T11:00:00Z' })];
    const { future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(future.map((t) => t.title)).toEqual(['a']);
  });

  it('splits later today from future by the local day of doAfter', () => {
    const tasks = [
      task({ title: 'a', doAfter: '2026-09-08T23:59:00Z' }),
      task({ title: 'b', doAfter: '2026-09-09T09:00:00Z' }),
    ];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(laterToday.map((t) => t.title)).toEqual(['a']);
    expect(future.map((t) => t.title)).toEqual(['b']);
    expect(ready).toHaveLength(0);
  });

  it('respects the time zone when deciding today', () => {
    const tasks = [task({ title: 'a', doAfter: '2026-09-09T01:00:00Z' })];
    const { laterToday } = partitionDeferred(tasks, NOW, 'America/Sao_Paulo');
    expect(laterToday.map((t) => t.title)).toEqual(['a']);
  });

  it('sorts future by doAt then list order', () => {
    const tasks = [
      task({ title: 'a', doAt: '2026-09-10', tasksListOrder: 0 }),
      task({ title: 'b', doAt: '2026-09-09', tasksListOrder: 5 }),
      task({ title: 'c', doAt: '2026-09-10', tasksListOrder: 3 }),
    ];
    const { future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(future.map((t) => t.title)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 1 }),
      task({ title: 'b', tasksListOrder: 0 }),
    ];
    partitionDeferred(tasks, NOW, 'UTC');
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
