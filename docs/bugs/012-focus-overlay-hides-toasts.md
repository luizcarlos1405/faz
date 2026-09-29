# BUG-012: Focus overlay hides toasts, making Undo unreachable in focus mode

- **Status:** NEEDS FIX
- **Severity:** Minor (undo/feedback unavailable during focus sessions; defer itself works)
- **Area:** components layering (shell)
- **Files:** `src/lib/components/focus-mode.svelte` (z-index), `src/lib/components/toast-container.svelte` (`z-40`), `src/routes/(app)/tasks/+page.svelte` (FAB `z-50`)

## Symptom

Actions taken in focus mode (defer via the clock picker, postpone, done) show a toast
("Hidden until 14:35", "Postponed to tomorrow") with an **Undo** action, but the toast
renders underneath the fullscreen focus overlay and can neither be seen nor clicked.
Even after exiting focus mode, on `/tasks` the toast's Undo button overlaps the
floating action button (`z-50` vs toast `z-40`), so clicks near the button hit the FAB
instead.

Verified in browser automation (Playwright): the Undo `click` is reported as
"subtree intercepts pointer events" — first by the focus overlay's spacer
(`<div class="h-[60px]">`), then by the FAB's SVG on the tasks page.

## Root cause

- Focus mode is `fixed inset-0 z-[100]`; the global toast container is
  `fixed bottom-20 z-40` in the root layout. Both live in the root stacking context,
  so the overlay always paints above the toast and swallows its pointer events.
- On `/tasks`, the FAB wrapper is `z-50` (`pointer-events-auto` on the button), also
  above the toast container. The toast is bottom-anchored full-width with the Undo
  button right-aligned (`ml-auto`), exactly where the FAB sits.

Pre-existing issue, unrelated to the `doAfterTime` refactor — it reproduces with any
focus-mode action that toasts.

## Fix

`src/lib/components/toast-container.svelte`: container class `z-40` → `z-[200]`,
painting above both the focus overlay (`z-[100]`) and the FAB (`z-50`). The wrapper
already had `pointer-events-none` with `pointer-events-auto` on individual toasts, so
no other change was needed.

Verified in browser automation: the focus defer flow's Undo button now receives a
plain (non-forced) click while the focus overlay is up — previously the same
interaction timed out with "subtree intercepts pointer events".

## Suggested tests

- e2e: defer a task in focus mode, then
  `expect(toast.getByRole('button', { name: 'Undo' })).toBeClickable()` (a plain
  visibility assertion is not enough — Playwright reports the toast as "visible"
  even when covered).
- e2e: with ≥1 task on `/tasks` (FAB visible), trigger postpone, click the toast's
  Undo by mouse at its own coordinates, assert the task returned to To do.
