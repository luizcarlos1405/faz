# BUG-002: One malformed plan stops all scheduling app-wide

- **Status:** NEEDS FIX
- **Severity:** High (blast radius: every plan)
- **Area:** core engine + shell (`scheduler.ts`)
- **Files:** `src/lib/engines/care-engine.ts` (all `Temporal.PlainDate.from` / `Duration.from` call sites), `src/lib/scheduler.ts` — `doRun`, `src/lib/db/error-repo.ts` (`logError` already exists)

## Symptom

A single corrupt plan document breaks the entire scheduler: `runSchedulerNow()` rejects,
no plan gets evaluated, and no tasks are generated for any care. The failure is silent
unless you watch the console for the unhandled rejection.

## Root cause

`doRun` (scheduler.ts) awaits `runScheduler(...)` with **no per-plan isolation**. Any
throw aborts the whole loop. Ways a stored plan can throw:

- `Temporal.PlainDate.from` `RangeError` on invalid `recurrence.startDate` or
  `plan.lastDoAtDate` strings (legacy/imported/agent-written data, e.g. `2026-13-45`);
- `Temporal.Duration.from` `RangeError` on fractional intervals (verified:
  `{ days: 0.5 }` throws);
- `PlainDate.from({ day: 0 })` / `month: 13` from corrupt `daysOfMonth` / `yearDates`.

Additionally one case is **silently wrong** instead of throwing: a `daysOfWeek` value
outside 1-7 (e.g. 9) never matches in `nextWeekday`, which returns `from + 7 days`
regardless.

Affected callers: `+layout.svelte` `syncAndRefresh` (mount, 5-minute interval,
visibility change — unhandled rejection), `cares-page-state` actions (`addTaskPlan`
et al. save the plan first, then `runSchedulerNow` rejects and breaks the flow after
the save already persisted), and the AI tools registry.

## Reproduction

Create a care with a plan whose `recurrence.startDate = '2026-13-45'` (e.g. via
`window` DB access in dev). Reload the app: the scheduler creates tasks for **no**
plan, console shows an unhandled rejection from `runSchedulerNow`.

## Suggested fix

Keep the core pure — report, don't log, from the engine:

1. In `runScheduler`, wrap the per-plan evaluation (`applyOverdueBehavior` +
   `evaluateTaskPlan`) in `try/catch`; collect
   `failedPlans: Array<{ planId: string; careId: string; error: string }>` in the
   return value and skip the failed plan.
2. In `doRun`, write one `logError({ code: 'SCHEDULER_PLAN_FAILED', ... })` per failed
   plan (see the existing `SCHEDULER_CONCURRENT` usage for the pattern).
3. Optionally add a pure `validateRecurrence(recurrence)` helper (shape + range checks:
   ISO dates, interval fields integers >= 0 summing > 0, `daysOfWeek` within 1-7,
   `daysOfMonth` within 1-31) reused by the wizard (BUG-006) and callable from
   `runScheduler` so validation errors land in `failedPlans` instead of exceptions.

## Suggested tests

- Care A with a plan whose `startDate` is `'not-a-date'` + care B with a valid plan:
  `runScheduler` returns B's task and `failedPlans` contains A; no throw.
- `daysOfWeek: [9]` is either rejected by `validateRecurrence` or its behavior
  documented (decide during the fix).

## Interactions / notes

- BUG-006 (invalid intervals) lands here once isolation exists: a `{ days: 0 }` plan
  becomes a `failedPlans` entry instead of a hang.
- Do not let `failedPlans` include plan-evaluation results that are legitimately `null`;
  only actual errors/invalid input.
