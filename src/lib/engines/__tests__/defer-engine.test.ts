import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  isDeferred,
  partitionDeferred,
  parseTimeOfDay,
  toTimeOfDay,
  isFutureTime,
  nextRoundedTime,
  withDoAt,
  withDoAfterTime,
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

describe('parseTimeOfDay', () => {
  it('parses a valid HH:MM value', () => {
    expect(parseTimeOfDay('09:30')).toEqual({ hour: 9, minute: 30 });
    expect(parseTimeOfDay('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeOfDay('00:00')).toEqual({ hour: 0, minute: 0 });
  });

  it('rejects malformed or absent values', () => {
    expect(parseTimeOfDay(undefined)).toBeNull();
    expect(parseTimeOfDay('9:30')).toBeNull();
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('12:60')).toBeNull();
    expect(parseTimeOfDay('not-a-time')).toBeNull();
  });
});

describe('toTimeOfDay', () => {
  it('zero-pads hour and minute', () => {
    expect(toTimeOfDay(9, 5)).toBe('09:05');
    expect(toTimeOfDay(23, 45)).toBe('23:45');
    expect(toTimeOfDay(0, 0)).toBe('00:00');
  });
});

describe('isDeferred', () => {
  it('is false when doAfterTime is absent', () => {
    expect(isDeferred(task(), NOW, 'UTC')).toBe(false);
  });

  it('is false when doAfterTime is malformed', () => {
    expect(isDeferred(task({ doAfterTime: 'not-a-time' }), NOW, 'UTC')).toBe(false);
  });

  it('is true when the local time is before doAfterTime', () => {
    expect(isDeferred(task({ doAfterTime: '15:00' }), NOW, 'UTC')).toBe(true);
  });

  it('is false when the local time equals doAfterTime', () => {
    expect(isDeferred(task({ doAfterTime: '12:00' }), NOW, 'UTC')).toBe(false);
  });

  it('is false when doAfterTime has passed', () => {
    expect(isDeferred(task({ doAfterTime: '11:00' }), NOW, 'UTC')).toBe(false);
  });

  it('compares against the local time in the given time zone', () => {
    expect(isDeferred(task({ doAfterTime: '10:00' }), NOW, 'America/Sao_Paulo')).toBe(true);
    expect(isDeferred(task({ doAfterTime: '10:00' }), NOW, 'UTC')).toBe(false);
  });
});

describe('partitionDeferred', () => {
  it('splits ready and later today and sorts ready by list order', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 2 }),
      task({ title: 'b', tasksListOrder: 0, doAfterTime: '15:00' }),
      task({ title: 'c', tasksListOrder: 1 }),
      task({ title: 'd', tasksListOrder: 3, doAfterTime: '13:00' }),
    ];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(ready.map((t) => t.title)).toEqual(['c', 'a']);
    expect(laterToday.map((t) => t.title)).toEqual(['d', 'b']);
    expect(future).toHaveLength(0);
  });

  it('treats a passed doAfterTime as ready', () => {
    const tasks = [task({ title: 'a', doAfterTime: '11:00', tasksListOrder: 0 })];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(ready).toHaveLength(1);
    expect(laterToday).toHaveLength(0);
    expect(future).toHaveLength(0);
  });

  it('treats a malformed doAfterTime as ready', () => {
    const tasks = [task({ title: 'a', doAfterTime: 'later' })];
    const { ready, laterToday } = partitionDeferred(tasks, NOW, 'UTC');
    expect(ready).toHaveLength(1);
    expect(laterToday).toHaveLength(0);
  });

  it('breaks doAfterTime ties by list order', () => {
    const tasks = [
      task({ title: 'a', tasksListOrder: 5, doAfterTime: '13:00' }),
      task({ title: 'b', tasksListOrder: 1, doAfterTime: '13:00' }),
    ];
    const { laterToday } = partitionDeferred(tasks, NOW, 'UTC');
    expect(laterToday.map((t) => t.title)).toEqual(['b', 'a']);
  });

  it('puts tasks dated beyond today in future even without doAfterTime', () => {
    const tasks = [
      task({ title: 'a', doAt: '2026-09-09', tasksListOrder: 1 }),
      task({ title: 'b', doAt: '2026-09-10', tasksListOrder: 0 }),
    ];
    const { ready, laterToday, future } = partitionDeferred(tasks, NOW, 'UTC');
    expect(future.map((t) => t.title)).toEqual(['a', 'b']);
    expect(ready).toHaveLength(0);
    expect(laterToday).toHaveLength(0);
  });

  it('puts future-dated tasks in future regardless of doAfterTime', () => {
    const tasks = [task({ title: 'a', doAt: '2026-09-09', doAfterTime: '15:00' })];
    const { future, laterToday } = partitionDeferred(tasks, NOW, 'UTC');
    expect(future.map((t) => t.title)).toEqual(['a']);
    expect(laterToday).toHaveLength(0);
  });

  it('compares the local time in the given time zone', () => {
    const tasks = [task({ title: 'a', doAfterTime: '10:00' })];
    expect(partitionDeferred(tasks, NOW, 'America/Sao_Paulo').laterToday).toHaveLength(1);
    expect(partitionDeferred(tasks, NOW, 'UTC').ready).toHaveLength(1);
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

describe('isFutureTime', () => {
  it('is true strictly after the local time', () => {
    expect(isFutureTime('12:01', NOW, 'UTC')).toBe(true);
  });

  it('is false at or before the local time', () => {
    expect(isFutureTime('12:00', NOW, 'UTC')).toBe(false);
    expect(isFutureTime('11:00', NOW, 'UTC')).toBe(false);
  });

  it('is false for malformed input', () => {
    expect(isFutureTime('nope', NOW, 'UTC')).toBe(false);
  });

  it('compares against the local time in the given time zone', () => {
    expect(isFutureTime('10:00', NOW, 'America/Sao_Paulo')).toBe(true);
    expect(isFutureTime('10:00', NOW, 'UTC')).toBe(false);
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
  it('sets the date and keeps doAfterTime when the date changes', () => {
    const t = task({ doAfterTime: '15:00' });
    const next = withDoAt(t, '2026-09-09');
    expect(next.doAt).toBe('2026-09-09');
    expect(next.doAfterTime).toBe('15:00');
    expect(t.doAt).toBe('2026-09-08');
    expect(next).not.toBe(t);
  });

  it('returns a new object when the date is unchanged', () => {
    const t = task({ doAfterTime: '15:00' });
    const next = withDoAt(t, '2026-09-08');
    expect(next.doAfterTime).toBe('15:00');
    expect(next).not.toBe(t);
  });
});

describe('withDoAfterTime', () => {
  it('sets doAfterTime', () => {
    expect(withDoAfterTime(task(), '15:00').doAfterTime).toBe('15:00');
  });

  it('removes doAfterTime for null and undefined', () => {
    const t = task({ doAfterTime: '15:00' });
    expect('doAfterTime' in withDoAfterTime(t, null)).toBe(false);
    expect('doAfterTime' in withDoAfterTime(t, undefined)).toBe(false);
    expect(t.doAfterTime).toBeDefined();
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
