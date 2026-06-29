import { RECURRENCE_TYPE, INTERVAL_SUBTYPE, FIXED_DAYS_SUBTYPE, PLAN_TYPE } from '$lib/types';
import type { Recurrence, PlanType, FixedDaysSubtype, DurationLike } from '$lib/types';

export interface WizardRecurrenceInput {
  scheduleType: PlanType;
  interval: DurationLike;
  daysSubtype: FixedDaysSubtype;
  daysOfWeek: number[];
  daysOfMonth: number[];
  yearDates: { month: number; day: number }[];
  startDate: string;
}

function trimmedInterval(interval: DurationLike): DurationLike {
  return {
    years: interval.years || undefined,
    months: interval.months || undefined,
    weeks: interval.weeks || undefined,
    days: interval.days || undefined,
  };
}

export function buildRecurrence(input: WizardRecurrenceInput): Recurrence {
  if (input.scheduleType === PLAN_TYPE.INTERVAL_FIXED.value) {
    return {
      type: RECURRENCE_TYPE.INTERVAL.value,
      subtype: INTERVAL_SUBTYPE.FIXED.value,
      interval: trimmedInterval(input.interval),
      startDate: input.startDate,
    };
  }
  if (input.scheduleType === PLAN_TYPE.INTERVAL_AFTER_DONE.value) {
    return {
      type: RECURRENCE_TYPE.INTERVAL.value,
      subtype: INTERVAL_SUBTYPE.AFTER_DONE.value,
      interval: trimmedInterval(input.interval),
      startDate: input.startDate,
    };
  }
  if (input.daysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) {
    return {
      type: RECURRENCE_TYPE.FIXED_DAYS.value,
      subtype: FIXED_DAYS_SUBTYPE.WEEKDAYS.value,
      daysOfWeek: input.daysOfWeek,
      startDate: input.startDate,
    };
  }
  if (input.daysSubtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) {
    return {
      type: RECURRENCE_TYPE.FIXED_DAYS.value,
      subtype: FIXED_DAYS_SUBTYPE.MONTHDAYS.value,
      daysOfMonth: input.daysOfMonth,
      startDate: input.startDate,
    };
  }
  return {
    type: RECURRENCE_TYPE.FIXED_DAYS.value,
    subtype: FIXED_DAYS_SUBTYPE.YEARDAYS.value,
    dates: input.yearDates,
    startDate: input.startDate,
  };
}

export function isValidRecurrence(input: WizardRecurrenceInput): boolean {
  if (input.scheduleType.startsWith('INTERVAL')) {
    const { years, months, weeks, days } = input.interval;
    return (years ?? 0) + (months ?? 0) + (weeks ?? 0) + (days ?? 0) > 0;
  }
  if (input.daysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) return input.daysOfWeek.length > 0;
  if (input.daysSubtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) return input.daysOfMonth.length > 0;
  return input.yearDates.length > 0;
}
