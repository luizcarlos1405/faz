import { describe, it, expect } from 'vitest';
import { completedOnLocalDate } from '../completed-date';

describe('completedOnLocalDate', () => {
  it('returns the local calendar date for an evening completion', () => {
    const instant = '2026-09-02T22:30:00-03:00';
    expect(completedOnLocalDate(instant, 'America/Sao_Paulo')).toBe('2026-09-02');
  });

  it('returns the UTC calendar date for the same instant in UTC', () => {
    const instant = '2026-09-02T22:30:00-03:00';
    expect(completedOnLocalDate(instant, 'UTC')).toBe('2026-09-03');
  });

  it('handles a completion early in the local morning', () => {
    const instant = '2026-09-03T01:30:00Z';
    expect(completedOnLocalDate(instant, 'America/Sao_Paulo')).toBe('2026-09-02');
  });

  it('accepts a plain Z-form instant for the given timezone', () => {
    const instant = '2026-09-03T01:30:00Z';
    expect(completedOnLocalDate(instant, 'UTC')).toBe('2026-09-03');
  });
});
