# BUG-008: FIXED_DAYS generates out of order and materializes far ahead

- **Status:** FIXED (out-of-order generation; commits `fd33cba` tests, `c3ec3e9` fix).
  The optional lookahead cap (part 2) was not implemented — product decision left open.
- **Severity:** Low (no duplicates/misses, but surprising behavior and wider exposure to other bugs)
- **Area:** core engine
- **Files:** `src/lib/engines/care-engine.ts` — `evaluateTaskPlan` `tasks[0]` cap (~41-44), `evaluateFixedDays` iteration order (~108-129), `runScheduler` `lastDoAtDate` write (~163)

## Symptom / summary

Two related quirks:

1. **Out-of-order generation.** `runScheduler` materializes only **one task per plan per
   run** (`evaluateTaskPlan` returns `tasks[0]`), and `evaluateFixedDays` iterates
   `daysOfWeek` / `daysOfMonth` / `dates` in **stored array order**, not chronological
   order. `MONTHDAYS [1, 15]` run on Sep 2 generates `2026-10-01` first and
   `2026-09-15` only on the next run. `lastDoAtDate` then regresses
   (`2026-10-01` -> `2026-09-15`), which re-opens BUG-007's resurrection window and
   makes plan state hard to reason about.
2. **Early materialization.** The next occurrence per selected day is always
   materialized, however far out: WEEKDAYS up to 7 days, MONTHDAYS up to ~1 month,
   YEARDAYS up to 12 months, INTERVAL/FIXED one interval. These future TODOs are
   invisible in the tasks list (`getVisibleTasks` filters `doAt <= today`) but sit in
   the DB (the user's live data contains an Oct 1 task generated on Sep 2), widen
   BUG-005's stale-task and BUG-007's resurrection exposure, and get a `tasksListOrder`
   assigned on creation.

## Root cause

`evaluateFixedDays` pushes candidates in iteration order of the user-entered arrays and
never sorts; `evaluateTaskPlan` returns the first element. Nothing bounds how far ahead
`nextWeekday` / `nextMonthday` / `nextYearday` may land.

## Reproduction

`MONTHDAYS [1, 15]`, no tasks, today `2026-09-02`:
`evaluateFixedDays` returns `['2026-10-01', '2026-09-15']` (array order);
`runScheduler` generates `2026-10-01` and sets `lastDoAtDate: '2026-10-01'`; the next
run generates `2026-09-15` and sets `lastDoAtDate: '2026-09-15'` (regression).

## Suggested fix

1. Sort `evaluateFixedDays`' result chronologically before returning
   (`tasks.sort((a, b) => a.doAt.localeCompare(b.doAt))`) so `tasks[0]` is always the
   earliest missing occurrence. One line; removes the `lastDoAtDate` regression.
2. (Product decision, optional) cap the materialization lookahead — e.g. only generate
   occurrences within N days of today (say 7 or 31). Nothing user-visible changes
   (future tasks are not displayed); it just shrinks the DB footprint and BUG-005/007
   exposure. Decide per subtype: birthdays (YEARDAYS) may legitimately want a longer
   horizon if reminders ever become a feature.

## Suggested tests

- `MONTHDAYS [1, 15]`, today `2026-09-02`, no tasks → `evaluateFixedDays` returns
  `['2026-09-15', '2026-10-01']` in that order.
- `runScheduler` on the same setup generates `2026-09-15` first
  (`lastDoAtDate: '2026-09-15'`), and the following run generates `2026-10-01`.
- Existing WEEKDAYS ordering tests (e.g. `[1, 3, 5]` from `2026-05-15`) stay green —
  they assert set membership/dates, and sorting must not change which dates are
  produced.

## Resolution

Fixed in two commits (TDD):

- `fd33cba` — tests: `FIXED_DAYS chronological generation order` in
  `care-engine.test.ts` pins chronological output for MONTHDAYS, YEARDAYS and WEEKDAYS
  regardless of stored array order, plus a two-run `runScheduler` sequence asserting the
  earliest occurrence (`2026-09-15`) is generated before `2026-10-01` with no
  `lastDoAtDate` regression.
- `c3ec3e9` — fix: `evaluateFixedDays` returns `tasks.toSorted((a, b) =>
a.doAt.localeCompare(b.doAt))`, so `evaluateTaskPlan`'s `tasks[0]` cap always picks the
  earliest missing occurrence.

The optional lookahead cap (part 2) is a product decision and was **not** implemented.

## Interactions / notes

- BUG-007's repro depends on the current out-of-order generation; fixing this bug
  narrows (but does not close) that window.
