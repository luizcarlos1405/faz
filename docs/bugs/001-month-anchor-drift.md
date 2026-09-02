# BUG-001: Monthly interval plans drift off their anchor day

- **Status:** FIXED (commit `972815d`; tests `8abb599`, `6289b20`; BUG-006 engine guard `1455b03`)
- **Severity:** High (silent schedule corruption)
- **Area:** core engine
- **Files:** `src/lib/engines/care-engine.ts` — `evaluateIntervalFixed` (~lines 48-72), `addDuration` (~lines 206-214), `runScheduler` lastDoAtDate write (~line 163)

## Symptom

An `INTERVAL/FIXED` plan with interval `{ months: 1 }` anchored on day 29/30/31 of a month
silently moves to the 28th (or lower) after passing a shorter month, and never returns.
"Every 1 month starting Jan 31" becomes "the 28th, forever".

## Root cause

`evaluateIntervalFixed` computes each candidate as
`addDuration(plan.lastDoAtDate, interval)`, and `runScheduler` persists the **generated
(possibly clamped) date** back into `plan.lastDoAtDate`. Temporal's `PlainDate.add`
clamps to the target month's length, and the drift compounds because every cycle
re-anchors on the previously clamped date:

```
2027-01-31 + {months:1} -> 2027-02-28   (clamped)
2027-02-28 + {months:1} -> 2027-03-28   (anchor lost — drift is permanent)
2027-03-28 + {months:1} -> 2027-04-28
```

Verified empirically with the project's `@js-temporal/polyfill`.

`MONTHDAYS` plans are **immune**: `nextMonthday` recomputes the date from `daysOfMonth`
on every run, so clamping never accumulates. Only `INTERVAL/FIXED` (and marginally
`INTERVAL/AFTER_DONE`, see note below) drift.

## Reproduction (test sketch)

```ts
const plan = makePlan({
  type: RECURRENCE_TYPE.INTERVAL.value,
  subtype: INTERVAL_SUBTYPE.FIXED.value,
  interval: { months: 1 },
  startDate: '2027-01-31',
});
// run runScheduler with today = 2027-01-31 -> task doAt 2027-01-31, lastDoAtDate 2027-01-31
// feed the updated plan back, run with today = 2027-02-28 -> task doAt 2027-02-28
// feed back, run with today = 2027-03-01 -> currently 2027-03-28, desired 2027-03-31
```

## Suggested fix

Compute the candidate from the plan's `startDate` with **one** duration addition per
multiple, instead of chaining from `lastDoAtDate`:

- find the smallest integer `n >= 1` such that
  `addDuration(startDate, intervalScaledBy(n)) >= today` (iterate `n`, it is cheap);
- `candidate = addDuration(startDate, intervalScaledBy(n))`.

A single addition of `{ months: n }` from Jan 31 gives Mar 31 for `n = 2` — no
intermediate February clamp, so the anchor is preserved. Scale by multiplying each
`DurationLike` field by `n`.

Stop using `lastDoAtDate` as the anchor for `INTERVAL/FIXED` candidates (keep writing
it if useful for observability, or drop it for this subtype). Note the candidate-guard
added by BUG-010's fix (`hasTaskForDate` on the candidate) must keep working — it is
date-based and unaffected by the anchor change.

## Suggested tests

- The three-step chain above, asserting `2027-03-31`.
- `{ months: 1 }` from `2027-01-30`: Jan 30 -> Feb 28 -> **Mar 30**.
- Tighten the existing weak test `handles month boundary with months interval from Jan 31`
  (`care-engine.test.ts` ~line 514) which currently only asserts `month >= 2`.

## Fix applied

- `evaluateIntervalFixed` no longer anchors on `lastDoAtDate`. The candidate is the
  smallest `startDate + n * interval >= today`, computed with **one** scaled duration
  addition per multiple (`{months: 2}` from Jan 31 gives Mar 31 directly — no
  intermediate February clamp, anchor preserved). `lastDoAtDate` is still written by
  `runScheduler` (occurrence memory / "Last generated" display) but no longer feeds
  INTERVAL/FIXED candidates, so plans already drifted in stored data self-repair on
  the next run. The BUG-010 candidate guard (`hasTaskForDate`) is date-based and
  keeps working unchanged.
- Per the BUG-006 interaction note, the search loop also bails out (`null`) when the
  interval fails to advance the candidate (zero or negative total) — commit `1455b03`.
- `INTERVAL/AFTER_DONE` untouched: it anchors on actual completion dates, which
  arguably matches "N after you last did it" (product intent still open).

## Tests added

`care-engine.test.ts`: describe `INTERVAL FIXED month-anchor stability` (three-run
Jan 31 -> Feb 28 -> Mar 31 chain through `runScheduler`, clamped-`lastDoAtDate`
Jan 30 -> Mar 30, off-grid `lastDoAtDate` ignored, tightened the weak Jan 31
month-boundary test to the exact date) and describe
`INTERVAL FIXED non-positive interval guard` (zero and negative intervals return
`null` instead of hanging; those tests hang until killed before the guard).

## Interactions / notes

- BUG-006: harden the candidate search loop against zero/negative intervals at the same
  time (the `n` iteration replaces the current `while` loop).
- BUG-002: parse/validation failures of `startDate` should surface through per-plan error
  isolation, not abort the run.
- `INTERVAL/AFTER_DONE` anchors on `lastDoneDate` (an actual completion date), so the same
  clamping occurs — but each anchor is a fresh completion date, which arguably matches
  "N after you last did it". Confirm product intent before changing that subtype.
