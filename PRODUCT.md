# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily its author, plus people they'd share it with: GTD-minded individuals who want one calm place
for what they need to do. Faz is a phone-first PWA used in short moments through the day
(capture something, check what's next, tick it off); desktop is secondary.

## Product Purpose

Faz helps one person keep their life in order without pressure: capture loose thoughts, turn them
into tasks, goals and recurring care, and get through today one thing at a time. Success is a
person who trusts that nothing is forgotten and feels lighter, not judged, when they open it.

## Positioning

Four ideas together, which a plain to-do list doesn't have:

- **Cares**: care plans for areas of life (plants, health, home, people) that generate their own
  recurring tasks, so routine upkeep runs itself.
- **Focus mode**: one task at a time with Done / Later / Tomorrow, instead of staring at a list.
- **Calm GTD flow**: capture to the inbox, process it into tasks, goals or cares, then do. Low
  pressure, no guilt.
- **AI assistant**: a bring-your-own-key chat that can read and change your tasks through the same
  code paths as the UI.

## Operating Context

- One person, one browser. All data lives locally (PouchDB in IndexedDB); there are no accounts,
  sync or sharing.
- Used one-handed on a phone, often in passing; installed to the home screen as a PWA.
- Rituals: quick capture into the inbox, processing the inbox, checking today's list, focus
  sessions, reviewing goals and cares.

## Capabilities and Constraints

- **Tasks**: title, due day (`doAt`), optional hide-until time (`doAfterTime`), status to do /
  done / missed, optional goal (as an ordered step) or care plan. The Tasks screen shows To do,
  Later today, In the future and Done today; lists are drag-reorderable.
- **Inbox**: quick capture; each item is processed into a task, goal or care, or removed.
- **Goals**: statuses not started / in progress / review / completed, with ordered steps (tasks).
- **Cares**: each care has plans; a plan repeats every N days/weeks/months (fixed or after done),
  on weekdays, month days or yearly dates, and has an overdue behavior (keep, mark missed, discard).
- **Focus mode**: full-screen, one task, with a date picker, Tomorrow / +1 day, and Later with a
  hide-until time.
- **Chat**: BYOK providers (API keys stored locally), model picker, streaming, agent mode with an
  action log and undo.
- Data tools: import from Google Tasks, export/import, error log.
- Navigation today: bottom dock with Tasks, Inbox, Goals, Cares, Chat; the last tab is restored on
  launch.
- Built with SvelteKit 5, Tailwind v4 and DaisyUI v5; mockups are made in OpenPencil
  (`design/`).

## Brand Commitments

- **Name and mark**: "Faz" (Portuguese for "do"). The Efe logo, a lowercase f whose crossbar is a
  check, stays; its colors may change (`src/lib/utils/faz-logo.ts`).
- **Voice**: a calm friend, never a drill sergeant; plain words, sentence case, no fanfare
  ([docs/WRITING.md](docs/WRITING.md)).
- Must not feel gamified or pushy (streaks, badges, alarming overdue states, guilt), like a cold
  productivity tool (corporate, dense, Jira-like), or too decorative to be quick.

## Evidence on Hand

- Real copy and empty states in `src/routes/**` and `src/lib/components/**`; tone rules in
  `docs/WRITING.md`.
- Existing mockups in `design/faz.op` (AI chat, focus mode, wheel select, navigate).
- No testimonials, user counts or press exist; don't invent them.

## Product Principles

1. **Lighter after opening it.** Every screen should reduce pressure, never add it.
2. **Capture beats organizing.** Getting a thought out of your head must take seconds.
3. **One thing at a time.** Show what matters now; let the rest wait quietly.
4. **Routine runs itself.** Recurring care should need attention only when it's due.
5. **Your data, your device.** Local-first; nothing leaves the browser except chats you start.
