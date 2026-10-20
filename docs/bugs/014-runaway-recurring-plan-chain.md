# BUG-014: Runaway recurring-plan chain encodes years of future occurrences

- **Status:** FIXED (code hardened in commits `972815d`, `c99c559`, `b3e5e94`; historical
  data scrubbed by migration v4, `recoverRunawayPlan` + tests in this change)
- **Severity:** High (937 open tasks feeding the To-do list until 2036)
- **Area:** core engine + historical data
- **Files:** `src/lib/engines/care-engine.ts` (`evaluateIntervalFixed`,
  `recoverRunawayPlan`, `PlanRecovery`), `src/lib/db/migrations.ts` (migration v4),
  `src/lib/scheduler.ts` (`updatedPlans.lastDoAtDate` write)

## Symptom

A recurring task (care "Família", plan "Falar com o Mário") appeared **twice** in the
To-do list, and a new occurrence of the same task kept surfacing every few days
without the user ever creating one. On the user's restored backup the single plan had
**937 TODO tasks** (`doAt` from 2026-10-16 to **2036-09-13**, ~10 created per day
between 2026-04-17 and 2026-07-19).

## Root cause

Two-stage bug, both historical (engine was rewritten by `972815d` on 2026-09-02):

1. **Feed-forward generator.** `evaluateIntervalFixed` used to anchor candidates on
   `plan.lastDoAtDate + interval` (inherited from the old fixed anchor scheme, see
   BUG-001), and the scheduler then recorded every generated task into
   `updatedPlans.lastDoAtDate = task.doAt`. Candidate generation advanced
   `lastDoAtDate`, which advanced the next candidate: each scheduler run (~every 5
   minutes at the time, BUG-003's cadence) created **one more occurrence** until the
   loop stopped on 2026-07-19. This matches the observed 10/day creation rate and the
   duplicate-same-date pairs (concurrent runs before the `runSchedulerNow` inflight
   guard, `46a7eb7`, 2026-08-11).
2. **No occurrence guard.** The engine had no `hasTaskForDate`/`shouldGenerateForDate`
   check at all (added for INTERVAL/FIXED by `972815d`, for moved occurrences by
   `c99c559` / BUG-010). `makeTask`'s deterministic `_id`
   (`task_gen_<planId>_<doAt>`) is discarded by `createTask` (`nanoid()`), so nothing
   deduplicated at the storage layer either.

The engine bugs are fixed; what remained was the **historical junk in existing
databases** — no migration ever scrubbed it, so users kept seeing the chain (and
migration-running at every boot made it groan).

## Fix

- **Historical scrub (new).** `recoverRunawayPlan(plan, tasks)` in the engine (pure)
  decides what to remove:
  - INTERVAL (FIXED and AFTER_DONE): keep only the earliest **TODO** task for the
    plan (ordered by `doAt`, then `createdAt`), remove the rest, and set
    `lastDoAtDate` to the kept task's `doAt`; returns `null` when the plan is already
    clean.
  - FIXED_DAYS: keep one **TODO** task per date (earliest `createdAt`), remove same
    date duplicates; distinct dates are untouched (pre-materialized occurrences are
    legitimate, BUG-008 part 2).
- **Migration v4** runs the recovery for every plan of every care and deletes the
  surplus tasks. Databases importing an older backup re-run it on next boot
  (backup `meta:migrations` version < 4).
- **Guard hardening.** `evaluateIntervalFixed` now skips candidates equal to
  `plan.lastDoAtDate` (behind `shouldGenerateForDate`, mirroring FIXED_DAYS / BUG-010),
  so a same-day tab-restore run can't capture a moved occurrence a second time.

## Tests

`src/lib/engines/__tests__/care-engine.test.ts`:

- `recoverRunawayPlan`: keep earliest/remove chain, `lastDoAtDate` normalization,
  no-purging when clean, DONE/MISSED untouched, paused plans, FIXED_DAYS same-date
  dedupe and distinct-date no-op, plan scoping, input immutability.
- `INTERVAL FIXED candidate-date guard`: moved-occurrence skip on `lastDoAtDate`
  (same-day postpone) plus candidate-free resumption.

## Verification against real data

Backup exported 2026-10-20T12:59 restored into a browser: migration v4 ran on reload,
docs 1747 -> 840, "Falar com o Mário" collapsed to exactly one open task
(2026-10-16), "Lava Jato" to one (2026-10-23), "Tirar o lixo" kept its three distinct
dates. Completing the open occurrence generated exactly one next task
(`doAt = lastDoneDate + 4d`), no duplicates on later scheduler runs.

## Interactions

- BUG-005, BUG-007: far-future occurrences created exposure for these; scrub removes it.
- BUG-008 part 2: pre-materialized FIXED_DAYS occurrences are legitimate and kept.
- BUG-010: this extends the moved-occurrence guard to INTERVAL FIXED.
