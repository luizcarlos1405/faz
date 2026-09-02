# BUG-006: Zero/negative interval hangs the scheduler (infinite loop)

- **Status:** FIXED (engine guard in `1455b03` via BUG-001; per-plan error isolation via
  BUG-002 in `3f2c001`; wizard-side re-validation via shared `validateInterval` in
  `b9e68d5`)
- **Severity:** Low (UI prevents the common case; stored data is not re-validated)
- **Area:** core engine + wizard
- **Files:** `src/lib/engines/care-engine.ts` — `evaluateIntervalFixed` catch-up loop (~lines 65-67); `src/lib/engines/recurrence-wizard.ts` — `isValidRecurrence` (~80-88)

## Symptom

A plan whose interval totals zero (e.g. `{ days: 0 }`) **freezes the app** the next time
the scheduler runs: the catch-up `while` loop never terminates because the candidate
never advances. Fractional intervals (e.g. `{ days: 0.5 }`) throw `RangeError` instead
(verified with the project's polyfill) and hit BUG-002's blast radius.

## Root cause

The engine trusts the interval to advance the candidate:

```ts
while (Temporal.PlainDate.compare(candidate, today) < 0) {
  candidate = addDuration(candidate, r.interval);
}
```

Verified behaviors: `add({ days: 0 })` returns the same date (loop never exits);
`add({ years: -1 })` moves the date backward (loop never exits once behind `today`).

The wizard's `isValidRecurrence` checks `sum > 0`, which blocks all-zero intervals at
creation time, but:

- it does not reject **negative** fields that net positive
  (`{ years: -1, days: 400 }` passes validation and hangs the engine);
- nothing re-validates stored plans (legacy/imported/agent-written docs).

## Suggested fix

1. Harden `isValidRecurrence`: reject if any field is `< 0` or non-integer.
2. Add an engine guard in `evaluateIntervalFixed` (and wherever intervals are consumed,
   including the BUG-001 rework of the candidate search): compute the duration total
   first; if `total <= 0`, return `null` — or better, surface it through BUG-002's
   `failedPlans` once that exists.
3. Consider a shared pure `validateInterval(interval)` used by both the wizard and the
   engine so the rules cannot diverge.

## Suggested tests

- `evaluateIntervalFixed` with `{ days: 0 }` returns `null` (this test would time out
  before the fix).
- `{ years: -1, days: 400 }` returns `null`.
- `isValidRecurrence` rejects negative and fractional fields.

## Resolution

Closed in three pieces:

- Engine guard: `1455b03` (BUG-001 candidate-search rework detects a non-advancing
  candidate and returns `null`).
- Per-plan isolation: `3f2c001` (BUG-002) — shared pure `validateInterval` rejects
  negative/fractional fields and all-zero totals; `runScheduler` reports invalid-interval
  plans through `failedPlans` instead of hanging.
- Wizard re-validation: `625cea6` + `b9e68d5` — `isValidRecurrence` now delegates to the
  shared `validateInterval`; tests pin rejection of net-positive negative intervals
  (`{ years: -1, days: 400 }`) and fractional fields (`{ days: 0.5 }`).

## Interactions / notes

- Implement after (or together with) BUG-002: without per-plan isolation a malformed
  plan is a hang, which is strictly worse than a crash.
