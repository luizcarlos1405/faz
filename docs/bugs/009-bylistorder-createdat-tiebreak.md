# BUG-009: `byListOrder` createdAt tie-break mis-sorts mixed timestamp precisions

- **Status:** IGNORE
- **Severity:** Minor (cosmetic ordering in tie-breaks only)
- **Area:** core engine
- **Files:** `src/lib/engines/ordering.ts` — `byListOrder` (~lines 48-56)

## Symptom

When two items share the same list order, the newest-first tie-break can order them
wrong if their `createdAt` timestamps have different fractional-second precisions.
Affects the tasks list and the cares list (repo data contains a mix of 3-digit and
9-digit fractions, e.g. `…​T18:52:24.955Z` vs `…​T15:16:45.216405176Z`).

## Root cause

`b.createdAt.localeCompare(a.createdAt)` compares ISO strings lexicographically. When
one fractional-second string is a prefix of the other, `'Z'` (0x5A) sorts **after**
digits (0x30-0x39), so `.95Z` compares as **newer** than `.955Z` even though 0.95 <
0.955 seconds:

```
'…T15:16:45.95Z'  vs '…T15:16:45.955Z'
common prefix '…T15:16:45.95', then 'Z' > '5'  -> wrong order
```

Only reachable when orders tie **and** timestamps fall in the same second with
prefix-related fractions — rare, but the repo's mixed precisions make it possible.

## Suggested fix

Compare parsed instants in the tie-break:

```ts
return (
  Temporal.Instant.from(b.createdAt).epochMilliseconds -
  Temporal.Instant.from(a.createdAt).epochMilliseconds
);
```

(or `.until()`). Parsing existing strings is pure (no clock access), so this stays
inside the functional-core rules. Sub-millisecond ties can fall back to the string
compare for stability.

## Suggested tests

- Two items with equal order, `createdAt` `'2026-08-06T15:16:45.955Z'` and
  `'2026-08-06T15:16:45.95Z'` → the `.955` one (newer) sorts first.
