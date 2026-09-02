import { Temporal } from '@js-temporal/polyfill';

export function completedOnLocalDate(completedAt: string, timeZone: string): string {
  return Temporal.Instant.from(completedAt).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}
