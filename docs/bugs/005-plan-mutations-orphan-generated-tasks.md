# BUG-005: Plan edits/deletes orphan already-generated tasks

- **Status:** IGNORE
- **Severity:** Medium
- **Area:** shell (`db/care-repo.ts`) + new pure helpers in engine
- **Files:** `src/lib/db/care-repo.ts` — `updateTaskPlan` (~137-151), `removeTaskPlan` (~100-104), `removeCare` (~48-52); context: `makeTask` in `src/lib/engines/care-engine.ts` (~216-228)

## Symptom

- **(a) Stale schedule:** editing a plan's recurrence leaves already-generated future
  tasks on their old dates. Change `MONTHDAYS [1]` to `[5]` and the previously generated
  Oct 1 task still fires on Oct 1 even though the plan now says the 5th.
- **(b) Stale title:** generated tasks copy `plan.title` at materialization time
  (`makeTask`); renaming a plan does not rename its future tasks.
- **(c) Orphans on delete:** deleting a plan or a whole care leaves its generated TODO
  tasks in the DB forever (once the care doc is gone the origin label disappears too —
  `loadOrigins` swallows the fetch error).

## Root cause

Generated occurrences are materialized snapshots (title + doAt frozen at creation).
`updateTaskPlan` mutates only the plan doc; `removeTaskPlan`/`removeCare` delete only
care-side docs. Nothing reconciles the tasks that were already materialized — and
because FIXED_DAYS/YEARDAYS materialize occurrences far ahead (BUG-008), there is
usually a future task around to go stale. The only reconciled case today is
`moveTaskPlan`, which updates `careId` on the plan's tasks via
`updateTasksCareForPlan`.

## Reproduction

1. `MONTHDAYS [1]` plan; after a Sep 2 scheduler run there is a TODO task with
   `doAt: '2026-10-01'` (invisible in the list — future-dated — but in the DB).
2. Edit the plan to `daysOfMonth: [5]`.
3. Wait for Oct 1: the stale task appears even though the plan says the 5th.
   (Same with `removeTaskPlan`/`removeCare`: the TODO task never goes away.)

## Suggested fix

Implement the decision logic as pure engine helpers, with the shell doing the writes:

1. `tasksToCleanupForPlan(plan, tasks)` — returns which of the plan's TODO tasks are
   no longer valid occurrences under the **new** recurrence (for `updateTaskPlan`), and
   title updates to apply.
2. On `updateTaskPlan`: propagate the new title to the plan's TODO tasks; delete
   future-dated TODO tasks whose `doAt` is not a valid occurrence under the new
   recurrence and let the scheduler regenerate; **reset `lastDoAtDate`** when the
   recurrence changes so the BUG-010 equality guard cannot block regeneration of the
   new schedule (and BUG-007 resurrection cannot resurrect the old dates).
3. On `removeTaskPlan` / `removeCare`: remove the plan's TODO tasks (keep DONE/MISSED
   as history — confirm this product choice during the fix).

## Suggested tests

- Pure helper tests: plan changed `[1]` -> `[5]` with a TODO task at Oct 1 → marked for
  cleanup; TODO task at Oct 5 → kept; DONE task at Oct 1 → kept (history).
- Title propagation: future TODO task renamed, DONE task not renamed.

## Interactions / notes

- Depends conceptually on BUG-007 (deletion must actually stick) and benefits from a
  capped materialization horizon (BUG-008) — fewer stale future tasks to reconcile.
- A simple, robust alternative for (a): always reset `lastDoAtDate` and delete **all**
  future TODO tasks of the plan on any recurrence edit; the scheduler rebuilds them.
