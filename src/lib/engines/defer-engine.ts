import { Temporal } from '@js-temporal/polyfill';
import type { TaskDoc } from '$lib/types';
import { byListOrder } from './ordering';

function parseInstant(value: string | undefined): Temporal.Instant | null {
  if (!value) return null;
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}

export function isDeferred(task: Pick<TaskDoc, 'doAfter'>, now: Temporal.Instant): boolean {
  const doAfter = parseInstant(task.doAfter);
  if (!doAfter) return false;
  return Temporal.Instant.compare(now, doAfter) < 0;
}

export function partitionDeferred<T extends TaskDoc>(
  tasks: T[],
  now: Temporal.Instant,
  timeZone: string,
): { ready: T[]; laterToday: T[]; future: T[] } {
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate();
  const ready: T[] = [];
  const laterToday: T[] = [];
  const future: T[] = [];
  for (const task of tasks) {
    const doAfter = parseInstant(task.doAfter);
    if (Temporal.PlainDate.compare(Temporal.PlainDate.from(task.doAt), today) > 0) {
      future.push(task);
    } else if (doAfter && Temporal.Instant.compare(now, doAfter) < 0) {
      if (
        Temporal.PlainDate.compare(doAfter.toZonedDateTimeISO(timeZone).toPlainDate(), today) > 0
      ) {
        future.push(task);
      } else {
        laterToday.push(task);
      }
    } else {
      ready.push(task);
    }
  }
  return {
    ready: ready.toSorted(byListOrder((t) => t.tasksListOrder)),
    laterToday: laterToday.toSorted((a, b) => {
      const cmp = Temporal.Instant.compare(
        Temporal.Instant.from(a.doAfter!),
        Temporal.Instant.from(b.doAfter!),
      );
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

export function doAfterFromTime(
  date: Temporal.PlainDate,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  return date
    .toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from({ hour, minute }) })
    .toInstant()
    .toString();
}

export function isFutureTime(candidate: string, now: Temporal.Instant): boolean {
  const instant = parseInstant(candidate);
  if (!instant) return false;
  return Temporal.Instant.compare(instant, now) > 0;
}

export function timeOfDay(doAfter: string, timeZone: string): { hour: number; minute: number } {
  const time = Temporal.Instant.from(doAfter).toZonedDateTimeISO(timeZone);
  return { hour: time.hour, minute: time.minute };
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
  if (task.doAt === doAt) return { ...task };
  const next: T = { ...task, doAt };
  delete next.doAfter;
  return next;
}

export function withDoAfter<T extends TaskDoc>(task: T, doAfter: string | null | undefined): T {
  const next: T = { ...task };
  if (doAfter) {
    next.doAfter = doAfter;
  } else {
    delete next.doAfter;
  }
  return next;
}

export function msUntilNextMinute(now: Temporal.Instant): number {
  const ms = Number(now.epochMilliseconds % 60_000);
  return ms === 0 ? 60_000 : 60_000 - ms;
}
