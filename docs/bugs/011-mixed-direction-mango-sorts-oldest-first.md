# BUG-011: Mixed-direction mango sorts silently return oldest-first

- **Status:** NEEDS FIX
- **Severity:** Minor (list ordering wrong but harmless)
- **Area:** db repos (shell)
- **Files:** `src/lib/db/inbox-repo.ts` — `getUnprocessed` / `getProcessed` (~lines 33-51)

## Symptom

The inbox lists intend newest-first (`createdAt: 'desc'` in the sort) but actually
return **oldest first**: new items land at the bottom instead of the top.

## Root cause

pouchdb-find honors only the direction of the **first** sort field when deciding
whether to reverse the index scan (`isDescending` checks `sort[0]` only; see
`node_modules/pouchdb-find/lib/index.js`, the `// either all descending or all
ascending` branch). With `sort: [{ type: 'asc' }, { isProcessed: 'asc' },
{ createdAt: 'desc' }]` the scan runs ascending, so the `createdAt: 'desc'` is
silently ignored and docs come back oldest-first. Mixed asc/desc sorts are not
supported by mango — Cloudant rejects them; pouchdb-find just drops the extra
directions.

Fixed already for the error log (`src/lib/db/error-repo.ts` `getErrors`) by using an
**all-desc** sort `[{ type: 'desc' }, { createdAt: 'desc' }]`: the scan is reversed
and, because `type` is a single constant value, the effective order is
`createdAt` descending. (`goal-repo` / `care-repo` used the same broken pattern but
re-sort in memory afterwards, so they were never user-visible.)

## Suggested fix

Same idiom in both inbox queries:

```ts
sort: [{ type: 'desc' }, { isProcessed: 'desc' }, { createdAt: 'desc' }],
```

(or sort in memory after the fetch).

## Suggested tests

- e2e or repo-level: insert three inbox items out of chronological order;
  `getUnprocessed()` returns them newest-first. Same for `getProcessed()`.
