# BUG-003: Evening completions missing from "Done today" (UTC date)

- **Status:** NEEDS FIX
- **Severity:** Medium (user-visible data loss in a UI section)
- **Area:** shell (`db/`)
- **Files:** `src/lib/db/task-repo.ts` — `getDoneToday` (~line 125)

## Symptom

Tasks completed late in the day do not appear under "Done today" on the tasks page. In
UTC-3 that means anything completed after 21:00 local. The completion shows up in the
**next** day's done list instead.

## Root cause

`getDoneToday` does:

```ts
const completedDate = t.completedAt.slice(0, 10);
return completedDate === todayDate;
```

`completedAt` is `Temporal.Instant.toString()`, which is **always UTC `Z`-form** (e.g.
`2026-09-03T01:30:00Z`). Slicing the string yields the **UTC calendar date**, which is
compared against a **local** plain date. Verified with the project's polyfill:

```
instant 2026-09-02T22:30:00-03:00
slice(0,10) -> '2026-09-03'   (UTC date — wrong day)
local date  -> '2026-09-02'
```

## Suggested fix

Extract a pure helper (e.g. `src/lib/utils/completed-date.ts`):

```ts
import { Temporal } from '@js-temporal/polyfill';

export function completedOnLocalDate(completedAt: string, timeZone: string): string {
  return Temporal.Instant.from(completedAt).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}
```

Use it in `getDoneToday` with `Temporal.Now.timeZoneId()` (the shell owns the clock).
The helper stays pure (timezone injected), so it is unit-testable.

## Suggested tests

- `completedOnLocalDate('2026-09-02T22:30:00-03:00', 'America/Sao_Paulo')` === `'2026-09-02'`
- same instant with `'UTC'` === `'2026-09-03'`

## Interactions / notes

- Other `slice(0, 10)` uses are fine and should **not** be "fixed" blindly:
  `importers/google-tasks.ts` slices local-day strings from the Google export (date part
  is already what the user meant), and `data-modal.svelte` only builds a backup filename.
- Remember the repo rule: never use `new Date()`; go through Temporal as above.
