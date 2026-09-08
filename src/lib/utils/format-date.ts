import { Temporal } from '@js-temporal/polyfill';

const SHORT_WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function formatShortWeekday(isoDate: string): string {
  return SHORT_WEEKDAYS[Temporal.PlainDate.from(isoDate).dayOfWeek - 1];
}

export function formatFriendlyDate(
  isoDate: string,
  today: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): string {
  const date = Temporal.PlainDate.from(isoDate);
  const diff = date.until(today, { largestUnit: 'day' }).days;

  if (diff === 0) return 'Today';
  if (diff === -1) return 'Tomorrow';
  if (diff === 1) return 'Yesterday';

  const sameYear = date.year === today.year;

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatWeekdayDate(
  isoDate: string,
  today: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): string {
  const date = Temporal.PlainDate.from(isoDate);
  const sameYear = date.year === today.year;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatTime(instantIso: string, timeZone: string): string {
  return Temporal.Instant.from(instantIso)
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatClock(hour: number, minute: number): string {
  return Temporal.PlainTime.from({ hour, minute }).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
