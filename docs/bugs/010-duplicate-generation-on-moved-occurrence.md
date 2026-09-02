# BUG-010: Moved FIXED_DAYS occurrence duplicated on next scheduler run

- **Status:** FIXED (commit `c99c559`; regression tests in `517ab40`)
- **Severity:** was High (visible duplicate tasks)
- **Area:** core engine
- **Files:** `src/lib/engines/care-engine.ts` — `evaluateFixedDays`, `evaluateIntervalFixed`, `shouldGenerateForDate`

## Original symptom

A recurring task (e.g. "Repasse cotização", `MONTHDAYS [1]`, care "SecFin CLD") appeared
twice: one instance on the original date (yesterday) and one on the moved date (today),
after the user postponed it by one day.

## Root cause (as diagnosed from live data)

`evaluateFixedDays` deduplicated only via `hasTaskForDate(existingTasks, planId, next)` —
"a task currently sitting on the computed date". Postponing/editing a generated task
changes its `doAt`, so the guard passed and the next scheduler run re-created the
occurrence on its original date. `evaluateIntervalFixed` had no guard at all. The
deterministic `_id` built by `makeTask` (`task_gen_<planId>_<doAt>`) was discarded by
the create path (`createTask` overwrites it with `nanoid()`), so no storage-level
dedupe existed either.

Forensic timeline (from instrumentation, Sep 2026): task created Sep 1 17:56 for
`doAt 2026-09-01`; user postponed to `2026-09-02`; scheduler run at 18:41 re-created a
task for `2026-09-01` (same run batch-created another plan's task 0.4s later — proof of
a scheduler run).

## Fix applied

- `evaluateFixedDays`: skip candidate dates equal to `plan.lastDoAtDate` (new
  `shouldGenerateForDate` helper) — `runScheduler` already records every generation in
  `lastDoAtDate`, so it acts as occurrence memory. **Equality**, not `>=`: multi-date
  plans must not have one generated date block other dates.
- `evaluateIntervalFixed`: now receives `existingTasks` and skips generation when a
  task for the plan already sits on the computed candidate date.

Accepted behavior changes: a deleted FIXED_DAYS occurrence stays deleted until its
period passes (previously resurrected). Known residual (moved/deleted earlier
occurrence of a multi-date plan re-created once `lastDoAtDate` has advanced past it) is
tracked as BUG-007.

## Tests added

`care-engine.test.ts`, describes `FIXED_DAYS moved-occurrence guard` (MONTHDAYS
regression + next-occurrence resumption, WEEKDAYS, YEARDAYS, multi-date equality
boundary, delete-no-resurrect), `INTERVAL FIXED candidate-date guard`, and
`runScheduler moved-occurrence end to end`.

## Interactions

- BUG-007 (generalized residual), BUG-004 (AFTER_DONE past-dating), BUG-008
  (out-of-order generation re-opens the residual window).
