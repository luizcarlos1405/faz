# BUG-004: AFTER_DONE plans generate tasks dated in the past

- **Status:** NEEDS FIX
- **Severity:** Medium
- **Area:** core engine
- **Files:** `src/lib/engines/care-engine.ts` — `evaluateIntervalAfterDone` (~lines 74-93)

## Symptom

Deleting the next generated occurrence of an "N days after done" plan resurrects it
**dated in the past**, so it shows up immediately overdue. The user deletes it again,
the scheduler recreates it on the next run (5-minute interval / visibility change) —
whack-a-mole until the task is completed or moved.

## Root cause

`evaluateIntervalAfterDone` computes `doAt = lastDoneDate + interval` (or `startDate`
when `lastDoneDate` is unset) with **no floor at `today`**. The `today` parameter is
accepted but never used in the function body — the tell that no catch-up/floor logic
was ever written. The only guard is `hasActive` (any TODO task for the plan blocks
generation), which deletion defeats.

## Reproduction

1. Plan `INTERVAL/AFTER_DONE`, interval `{ days: 3 }`, `startDate: '2026-01-01'`.
2. Complete the task on Jan 1 → `markPlanDone` sets `lastDoneDate: '2026-01-01'`.
3. Scheduler run creates the Jan 4 task.
4. Delete that task.
5. Any later run (e.g. today = Jan 20) recreates a TODO with `doAt: '2026-01-04'` —
   16 days overdue. Deleting again → recreated on the next run.

Same shape with a stale `startDate`: first task for an old plan materializes in the
past.

## Suggested fix (minimal)

Floor the computed date at `today`:

```ts
const computed = lastDoneDate ? addDuration(...) : startDate;
const doAt = Temporal.PlainDate.compare(computed, today) < 0 ? today : computed;
```

This keeps "N after done" semantics while never scheduling into the past. The
resurrect-on-delete behavior itself is a semantics question tracked by BUG-007 — this
fix only stops the resurrected task from being overdue-dated.

## Suggested tests

- `lastDoneDate: '2026-01-01'`, interval `{ days: 3 }`, today `2026-01-20`, existing
  tasks `[]` → generated `doAt === '2026-01-20'` (floored).
- `lastDoneDate: '2026-01-19'`, today `2026-01-20` → `doAt === '2026-01-22'`
  (unfloored path).
- Keep the existing `hasActive` tests green.

## Interactions / notes

- Product decision embedded in the fix: a plan with a stale `startDate` and no
  completions gets its first task **today** instead of at the ancient `startDate`.
  Recommended: yes (surfaces the task instead of burying it as overdue history).
- BUG-007 may change the deletion semantics on top of this.
