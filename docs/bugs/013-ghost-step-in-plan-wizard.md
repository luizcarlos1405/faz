# BUG-013: Ghost step in the task plan wizard for interval plan types

- **Status:** FIXED
- **Severity:** Minor (extra useless "Next" click; wizard feels broken)
- **Area:** care detail page wizard (shell)
- **Files:** `src/routes/(app)/cares/[id]/+page.svelte` (wizard step conditions),
  `src/lib/components/interval-picker-form.svelte` (label typo),
  `src/lib/components/interval-picker.svelte` (singular interval summary)

## Symptom

Adding a new task plan with schedule type **Fixed interval** (or **After completion**):
after picking the interval and clicking **Next**, nothing visibly happens. A second
click is required to reach the **Start date** step — an invisible "ghost" step in
between.

## Root cause

The wizard drives a single `planStep` counter with hardcoded step numbers, but the
step layout differs per plan type:

| Step | FIXED_DAYS       | interval types         |
| ---- | ---------------- | ---------------------- |
| 0    | Task title       | Task title             |
| 1    | Schedule type    | Schedule type          |
| 2    | Day type select  | Interval picker        |
| 3    | Days detail      | **(nothing rendered)** |
| 4    | Start date       | Start date             |
| 5    | Overdue behavior | Overdue behavior       |

The step-3 block was gated on `planStep >= 3 && planType === FIXED_DAYS`, so for
interval plan types step 3 rendered nothing while `planStep` still counted it —
one "dead" Next click. **After completion** had the same ghost (its last step is
Start date). Additionally, switching schedule type mid-wizard kept `planStep`
unclamped, which could land beyond the new type's last step and produce ghost
steps when navigating Back.

## Fix

`src/routes/(app)/cares/[id]/+page.svelte`:

- Derived per-type step numbers instead of hardcoded ones:
  `startStep = isIntervalPlanType(planType) ? 3 : 4`;
  `lastStep = INTERVAL_AFTER_DONE ? startStep : startStep + 1`.
  Start date renders at `planStep >= startStep`, overdue at `planStep >= lastStep`
  (hidden for After completion). No plan type has an empty step anymore.
- Schedule-type `onchange` now clamps: `planStep = Math.min(Math.max(planStep, 2),
lastStep)`, so switching types mid-wizard can't overshoot the last step.

Also fixed while reviewing the form:

- `interval-picker-form.svelte`: wheel label typo "Weaks" → "Weeks".
- `interval-picker.svelte`: interval summary button now uses singular/plural
  ("1 week" instead of "1 weeks"), matching `describeRecurrence`.

## Suggested tests

Browser-level walk of the wizard for each schedule type (e.g. Playwright, pattern
from `docs/integration-tests.md`): after picking the interval at step 2, a single
Next must reveal Start date; for After completion a single Next must reveal
Start date + Add (no overdue step); Back from Start date returns to the interval
step. Verified this way via `playwright-cli` during the fix.
