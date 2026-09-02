<!-- MAINTENANCE: When you fix a bug listed here, flip its status to FIXED, add the
     fixing commit hash and a short summary of the fix and tests to that bug's file,
     and update the table below. When you discover a new bug, add a numbered file
     (next free number, priority order is only a suggestion) and a row here. -->

# Known Bugs

Each bug is documented in its own file with everything needed to pick it up without
re-deriving the analysis: symptom, root cause, reproduction, suggested fix, suggested
tests, and interactions with other bugs. Statuses are `NEEDS FIX`, `FIXED` or `IGNORE`.

## Index

| ID                                                                    | Title                                                      | Status | Severity |
| --------------------------------------------------------------------- | ---------------------------------------------------------- | ------ | -------- |
| [001](./001-month-anchor-drift.md)                                    | Monthly interval plans drift off their anchor day          | FIXED  | High     |
| [002](./002-scheduler-bricks-on-malformed-plan.md)                    | One malformed plan stops all scheduling app-wide           | FIXED  | High     |
| [003](./003-completed-date-utc-mismatch.md)                           | Evening completions missing from "Done today" (UTC date)   | FIXED  | Medium   |
| [004](./004-after-done-generates-past-dated-tasks.md)                 | AFTER_DONE plans generate tasks dated in the past          | IGNORE | Medium   |
| [005](./005-plan-mutations-orphan-generated-tasks.md)                 | Plan edits/deletes orphan already-generated tasks          | IGNORE | Medium   |
| [006](./006-zero-or-negative-interval-hangs-scheduler.md)             | Zero/negative interval hangs the scheduler (infinite loop) | FIXED  | Low      |
| [007](./007-inconsistent-resurrection-and-delete-semantics.md)        | Moved/deleted occurrences resurrect; semantics diverge     | IGNORE | Medium   |
| [008](./008-fixed-days-generation-order-and-early-materialization.md) | FIXED_DAYS generates out of order, far ahead               | FIXED  | Low      |
| [009](./009-bylistorder-createdat-tiebreak.md)                        | createdAt string tie-break mis-sorts mixed precisions      | IGNORE | Minor    |
| [010](./010-duplicate-generation-on-moved-occurrence.md)              | Moved FIXED_DAYS occurrence duplicated on next run         | FIXED  | High     |

## Picking up a bug

1. Ignore it if marked as IGNORE, explain that and ask if the user want's to do it anyway.
2. Read the bug's file fully — including the _Interactions_ section, several bugs share
   root causes or fix infrastructure.
3. Write the failing test(s) listed under _Suggested tests_ first
   (`src/lib/engines/__tests__/care-engine.test.ts` for engine bugs).
4. Implement the fix. Respect the functional-core rules from `AGENTS.md`: decisions in
   `src/lib/engines/` stay pure; the shell (`scheduler.ts`, repos) does the I/O.
5. Verify: `nix-shell shell.nix` then `bun run test`, `bun run check`, `bun run lint`.
6. Flip the status in the bug file and in the table above, and record the fixing commit.

All line references in the bug files are approximate, as of commit `517ab40`.
