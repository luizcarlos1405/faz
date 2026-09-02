import { describe, it, expect } from 'vitest';
import {
  buildRecurrence,
  isValidRecurrence,
  type WizardRecurrenceInput,
} from '../recurrence-wizard';
import { PLAN_TYPE, FIXED_DAYS_SUBTYPE, type DurationLike } from '$lib/types';

function baseInput(overrides: Partial<WizardRecurrenceInput> = {}): WizardRecurrenceInput {
  return {
    scheduleType: PLAN_TYPE.INTERVAL_FIXED.value,
    interval: { years: 0, months: 0, weeks: 1, days: 0 },
    daysSubtype: FIXED_DAYS_SUBTYPE.WEEKDAYS.value,
    daysOfWeek: [],
    daysOfMonth: [],
    yearDates: [],
    startDate: '2026-01-01',
    ...overrides,
  };
}

describe('buildRecurrence', () => {
  it('builds a fixed interval recurrence', () => {
    const r = buildRecurrence(baseInput({ scheduleType: PLAN_TYPE.INTERVAL_FIXED.value }));
    expect(r).toEqual({
      type: 'INTERVAL',
      subtype: 'FIXED',
      interval: { weeks: 1 },
      startDate: '2026-01-01',
    });
  });

  it('builds an after-done interval recurrence', () => {
    const r = buildRecurrence(
      baseInput({ scheduleType: PLAN_TYPE.INTERVAL_AFTER_DONE.value, interval: { days: 3 } }),
    );
    expect(r).toEqual({
      type: 'INTERVAL',
      subtype: 'AFTER_DONE',
      interval: { days: 3 },
      startDate: '2026-01-01',
    });
  });

  it('builds a weekdays recurrence', () => {
    const r = buildRecurrence(
      baseInput({
        scheduleType: PLAN_TYPE.FIXED_DAYS.value,
        daysSubtype: FIXED_DAYS_SUBTYPE.WEEKDAYS.value,
        daysOfWeek: [1, 3, 5],
      }),
    );
    expect(r).toEqual({
      type: 'FIXED_DAYS',
      subtype: 'WEEKDAYS',
      daysOfWeek: [1, 3, 5],
      startDate: '2026-01-01',
    });
  });

  it('builds a monthdays recurrence', () => {
    const r = buildRecurrence(
      baseInput({
        scheduleType: PLAN_TYPE.FIXED_DAYS.value,
        daysSubtype: FIXED_DAYS_SUBTYPE.MONTHDAYS.value,
        daysOfMonth: [1, 15],
      }),
    );
    expect(r).toEqual({
      type: 'FIXED_DAYS',
      subtype: 'MONTHDAYS',
      daysOfMonth: [1, 15],
      startDate: '2026-01-01',
    });
  });

  it('builds a yeardays recurrence', () => {
    const r = buildRecurrence(
      baseInput({
        scheduleType: PLAN_TYPE.FIXED_DAYS.value,
        daysSubtype: FIXED_DAYS_SUBTYPE.YEARDAYS.value,
        yearDates: [{ month: 6, day: 15 }],
      }),
    );
    expect(r).toEqual({
      type: 'FIXED_DAYS',
      subtype: 'YEARDAYS',
      dates: [{ month: 6, day: 15 }],
      startDate: '2026-01-01',
    });
  });

  it('drops zero-valued duration components', () => {
    const r = buildRecurrence(
      baseInput({ interval: { years: 0, months: 2, weeks: 0, days: 0 } as DurationLike }),
    );
    expect((r as { interval: DurationLike }).interval).toEqual({ months: 2 });
  });
});

describe('isValidRecurrence', () => {
  it('accepts a non-zero interval', () => {
    expect(isValidRecurrence(baseInput({ interval: { weeks: 1 } }))).toBe(true);
  });

  it('rejects an all-zero interval', () => {
    expect(isValidRecurrence(baseInput({ interval: {} }))).toBe(false);
  });

  it('rejects a negative interval that nets positive', () => {
    expect(isValidRecurrence(baseInput({ interval: { years: -1, days: 400 } }))).toBe(false);
  });

  it('rejects a negative interval field', () => {
    expect(isValidRecurrence(baseInput({ interval: { days: -7 } }))).toBe(false);
  });

  it('rejects a fractional interval field', () => {
    expect(isValidRecurrence(baseInput({ interval: { days: 0.5 } }))).toBe(false);
  });

  it('accepts non-empty weekdays', () => {
    expect(
      isValidRecurrence(
        baseInput({
          scheduleType: PLAN_TYPE.FIXED_DAYS.value,
          daysSubtype: FIXED_DAYS_SUBTYPE.WEEKDAYS.value,
          daysOfWeek: [2],
        }),
      ),
    ).toBe(true);
  });

  it('rejects empty weekdays', () => {
    expect(
      isValidRecurrence(
        baseInput({
          scheduleType: PLAN_TYPE.FIXED_DAYS.value,
          daysSubtype: FIXED_DAYS_SUBTYPE.WEEKDAYS.value,
        }),
      ),
    ).toBe(false);
  });

  it('accepts non-empty monthdays', () => {
    expect(
      isValidRecurrence(
        baseInput({
          scheduleType: PLAN_TYPE.FIXED_DAYS.value,
          daysSubtype: FIXED_DAYS_SUBTYPE.MONTHDAYS.value,
          daysOfMonth: [10],
        }),
      ),
    ).toBe(true);
  });

  it('rejects empty yeardates', () => {
    expect(
      isValidRecurrence(
        baseInput({
          scheduleType: PLAN_TYPE.FIXED_DAYS.value,
          daysSubtype: FIXED_DAYS_SUBTYPE.YEARDAYS.value,
        }),
      ),
    ).toBe(false);
  });
});
