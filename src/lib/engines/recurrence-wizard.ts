import {
  RECURRENCE_TYPE,
  INTERVAL_SUBTYPE,
  FIXED_DAYS_SUBTYPE,
  PLAN_TYPE,
  ISO_WEEKDAYS,
  MONTH_SHORT_NAMES,
} from '$lib/types';
import type { Recurrence, PlanType, FixedDaysSubtype, DurationLike } from '$lib/types';
import { validateInterval } from './care-engine';

const DAY_SHORT_NAMES = ['', ...ISO_WEEKDAYS.map((e) => e.name)];

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

export function isIntervalPlanType(scheduleType: PlanType): boolean {
  return (
    scheduleType === PLAN_TYPE.INTERVAL_FIXED.value ||
    scheduleType === PLAN_TYPE.INTERVAL_AFTER_DONE.value
  );
}

export function isValidRecurrence(input: WizardRecurrenceInput): boolean {
  if (isIntervalPlanType(input.scheduleType)) {
    return validateInterval(input.interval) === null;
  }
  if (input.daysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) return input.daysOfWeek.length > 0;
  if (input.daysSubtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) return input.daysOfMonth.length > 0;
  return input.yearDates.length > 0;
}

export function describeRecurrence(r: Recurrence): string {
  if (r.type === RECURRENCE_TYPE.INTERVAL.value && r.subtype === INTERVAL_SUBTYPE.FIXED.value) {
    return describeInterval(r.interval);
  }
  if (
    r.type === RECURRENCE_TYPE.INTERVAL.value &&
    r.subtype === INTERVAL_SUBTYPE.AFTER_DONE.value
  ) {
    return `${describeInterval(r.interval)} after last time you did it`;
  }
  if (
    r.type === RECURRENCE_TYPE.FIXED_DAYS.value &&
    r.subtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value
  ) {
    return `Every ${r.daysOfWeek.map((d) => DAY_SHORT_NAMES[d]).join(' and ')}`;
  }
  if (
    r.type === RECURRENCE_TYPE.FIXED_DAYS.value &&
    r.subtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value
  ) {
    const suffix = (n: number) => {
      if (n === 1 || n === 21 || n === 31) return 'st';
      if (n === 2 || n === 22) return 'nd';
      if (n === 3 || n === 23) return 'rd';
      return 'th';
    };
    return `Every ${r.daysOfMonth.map((d) => `${d}${suffix(d)}`).join(' and ')} of the month`;
  }
  if (
    r.type === RECURRENCE_TYPE.FIXED_DAYS.value &&
    r.subtype === FIXED_DAYS_SUBTYPE.YEARDAYS.value
  ) {
    return r.dates.map(({ month, day }) => `${MONTH_SHORT_NAMES[month]} ${day}`).join(' and ');
  }
  return 'Unknown schedule';
}

function describeInterval(d: {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
}): string {
  const parts: string[] = [];
  if (d.years) parts.push(`${d.years} year${d.years > 1 ? 's' : ''}`);
  if (d.months) parts.push(`${d.months} month${d.months > 1 ? 's' : ''}`);
  if (d.weeks) parts.push(`${d.weeks} week${d.weeks > 1 ? 's' : ''}`);
  if (d.days) parts.push(`${d.days} day${d.days > 1 ? 's' : ''}`);
  return parts.join(' and ');
}
