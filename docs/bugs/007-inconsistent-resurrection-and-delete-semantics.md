# BUG-007: Moved/deleted occurrences resurrect; delete semantics diverge across recurrence types

- **Status:** NEEDS FIX
- **Severity:** Medium (correctness, narrow windows; needs a product decision)
- **Area:** core engine + shell (scheduler create path)
- **Files:** `src/lib/engines/care-engine.ts` — `shouldGenerateForDate` (~234-236), `evaluateIntervalFixed` guard (~69), `makeTask` deterministic `_id` (~218); `src/lib/scheduler.ts` — `doRun` create loop routes through `createTask`; `src/lib/db/task-repo.ts` — `createTask` overwrites `_id` with `nanoid()`

## Symptom / summary

The three recurrence families react differently when a generated occurrence is moved or
deleted, and multi-date FIXED_DAYS plans still have a re-creation window:

1. **FIXED_DAYS** — a moved/deleted occurrence stays gone until its period passes
   (BUG-010's fix), **but only while `plan.lastDoAtDate` still equals that date**. The
   plan remembers just one date; for multi-date plans the memory gets overwritten by
   whichever occurrence was generated last.
2. **INTERVAL/FIXED** — deleting the next occurrence resurrects it on the following run
   (the candidate is recomputed from the anchor; the BUG-010 guard only blocks when a
   task sits exactly on the candidate date).
3. **INTERVAL/AFTER_DONE** — resurrects possibly dated in the past (BUG-004).

## Root cause

The plan's only occurrence memory is (a) tasks currently sitting on computed dates
(`hasTaskForDate`) and (b) a single `lastDoAtDate`. There is no per-occurrence record,
so "this occurrence was already materialized" is forgotten whenever the task leaves its
date or another occurrence overwrites the memory.

Contributing factor: `makeTask` already builds a deterministic `_id`
(`task_<prefix>gen_<planId>_<doAt>`) that would act as storage-level occurrence memory,
but `scheduler.ts` routes creation through `createTask`, which overwrites it with a
fresh `nanoid()` — so a re-creation attempt never collides with the existing doc.

## Reproduction

Multi-date residual window (the most reachable case):

1. `MONTHDAYS [1, 15]`, no tasks. Run on Sep 2: generates `2026-10-01`
   (`lastDoAtDate: '2026-10-01'` — iteration order, see BUG-008).
2. Next run generates `2026-09-15` (`lastDoAtDate: '2026-09-15'` — the Oct 1 memory is
   overwritten).
3. Delete the Oct 1 task. Next run re-creates it: `lastDoAtDate ('2026-09-15') !==
'2026-10-01'` and `hasTaskForDate('2026-10-01')` is false.

Same shape for `WEEKDAYS [1, 3]`: move Monday's task after Wednesday's occurrence was
generated (while still on Monday) → Monday is re-created.

## Suggested fix (choose one; A is recommended)

**A. Deterministic ids end-to-end (the "Option 2" from the BUG-010 analysis):**

- Add a repo function `createGeneratedTask(task: TaskDoc)` that persists the doc with
  the deterministic `_id` from `makeTask` (still computing `tasksListOrder` the way
  `createTask` does) and treats a PouchDB **409 conflict as "occurrence already
  exists — skip"**.
- `scheduler.ts` uses it instead of `createTask` for generated tasks.
- Moving a generated task keeps its `_id`, so any re-creation attempt for the original
  plan+date collides and is skipped — covers all recurrence types and multi-date plans
  uniformly.
- Caveats: existing generated tasks have `nanoid` ids (legacy: one duplicate cycle is
  possible if a legacy future task is moved before its date; optional one-time
  migration); deleting a task frees the id, so deletion resurrects unless tombstoned.

**B. Schema change:** `materializedDates: string[]` on `TaskPlan` (pruned to
`>= today - 1 period`); `shouldGenerateForDate` checks membership instead of equality.
Also covers deletes; needs migration/backfill.

Decide the unified semantic first: **"delete = skip this occurrence"** (recommended —
matches what BUG-010's fix already does for FIXED_DAYS) or "delete = regenerate". If
"skip", variant A needs a tombstone (e.g. keep a `deletedOccurrences` list on the plan,
or keep the deterministic doc with status `MISSED` instead of removing it).

## Suggested tests

- The `MONTHDAYS [1, 15]` repro above (delete Oct 1 after Sep 15 generated → not
  recreated).
- `WEEKDAYS [1, 3]`: move Monday's task after Wednesday generated, still Monday → no
  re-creation.
- `INTERVAL/FIXED`: delete the next occurrence → behaves per the chosen semantic.
- `INTERVAL/AFTER_DONE`: same, on top of BUG-004's floor.

## Interactions / notes

- BUG-010 (FIXED) introduced the current equality guard — its file documents the
  history. This bug is the generalization of its documented residual.
- BUG-005 (plan edits) should be implemented against the chosen semantic so cleanup
  deletions are not resurrected.
