import { Temporal } from '@js-temporal/polyfill';
import type { TaskDoc } from '$lib/types';
import { byListOrder } from './ordering';

const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeOfDay(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = TIME_OF_DAY_RE.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function minutesOfDay(time: { hour: number; minute: number }): number {
  return time.hour * 60 + time.minute;
}

export function toTimeOfDay(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isDeferred(
  task: Pick<TaskDoc, 'doAfterTime'>,
  now: Temporal.Instant,
  timeZone: string,
): boolean {
  const time = parseTimeOfDay(task.doAfterTime);
  if (!time) return false;
  return minutesOfDay(time) > minutesOfDay(now.toZonedDateTimeISO(timeZone));
}

export function partitionDeferred<T extends TaskDoc>(
  tasks: T[],
  now: Temporal.Instant,
  timeZone: string,
): { ready: T[]; laterToday: T[]; future: T[] } {
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate();
  const nowMinutes = minutesOfDay(now.toZonedDateTimeISO(timeZone));
  const ready: T[] = [];
  const laterToday: T[] = [];
  const future: T[] = [];
  for (const task of tasks) {
    const time = parseTimeOfDay(task.doAfterTime);
    if (Temporal.PlainDate.compare(Temporal.PlainDate.from(task.doAt), today) > 0) {
      future.push(task);
    } else if (time && minutesOfDay(time) > nowMinutes) {
      laterToday.push(task);
    } else {
      ready.push(task);
    }
  }
  return {
    ready: ready.toSorted(byListOrder((t) => t.tasksListOrder)),
    laterToday: laterToday.toSorted((a, b) => {
      const cmp = (a.doAfterTime ?? '').localeCompare(b.doAfterTime ?? '');
      if (cmp !== 0) return cmp;
      return byListOrder<T>((t) => t.tasksListOrder)(a, b);
    }),
    future: future.toSorted((a, b) => {
      const cmp = Temporal.PlainDate.compare(
        Temporal.PlainDate.from(a.doAt),
        Temporal.PlainDate.from(b.doAt),
      );
      if (cmp !== 0) return cmp;
      return byListOrder<T>((t) => t.tasksListOrder)(a, b);
    }),
  };
}

export function isFutureTime(time: string, now: Temporal.Instant, timeZone: string): boolean {
  const parsed = parseTimeOfDay(time);
  if (!parsed) return false;
  return minutesOfDay(parsed) > minutesOfDay(now.toZonedDateTimeISO(timeZone));
}

export function nextRoundedTime(
  now: Temporal.Instant,
  timeZone: string,
  stepMinutes = 5,
): { hour: number; minute: number } {
  const zoned = now.toZonedDateTimeISO(timeZone);
  const rounded = zoned.round({
    smallestUnit: 'minute',
    roundingIncrement: stepMinutes,
    roundingMode: 'ceil',
  });
  const next =
    Temporal.ZonedDateTime.compare(rounded, zoned) > 0
      ? rounded
      : rounded.add({ minutes: stepMinutes });
  return { hour: next.hour, minute: next.minute };
}

export function withDoAt<T extends TaskDoc>(task: T, doAt: string): T {
  return { ...task, doAt };
}

export function withDoAfterTime<T extends TaskDoc>(
  task: T,
  doAfterTime: string | null | undefined,
): T {
  const next: T = { ...task };
  if (doAfterTime) {
    next.doAfterTime = doAfterTime;
  } else {
    delete next.doAfterTime;
  }
  return next;
}

export function msUntilNextMinute(now: Temporal.Instant): number {
  const ms = Number(now.epochMilliseconds % 60_000);
  return ms === 0 ? 60_000 : 60_000 - ms;
}
