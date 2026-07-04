<!-- MAINTENANCE: Keep this file up-to-date with the reality of the codebase.
     Read src/lib/ai/**, src/routes/chat/**, and src/routes/settings/keys/**
     when changing the AI feature. Update this doc anytime you notice a
     discrepancy with the code. -->

# AI Assistant

Bring-your-own-key (BYOK) LLM chat that runs entirely in the browser. No server, no proxy:
the user's API key is stored in `localStorage` and `fetch` calls the provider directly.

The chat always runs in **agent mode**: every send goes through the agent loop with a system
prompt and tools, so the model always has app context and can act on the user's data.

Read this alongside the `ai/` entry in [`../AGENTS.md`](../AGENTS.md), which maps the
core/shell split. This doc covers how the pieces fit together at runtime.

## Routes

| Route            | Purpose                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `/chat`          | The chat surface. First bottom-nav tab; root `/` redirects here.                                         |
| `/settings/keys` | Per-provider API key management. Not in the bottom nav — reached from the top-bar menu and from `/chat`. |

The Chat nav item matches both `/chat` and `/settings/keys`, so it stays highlighted while the
user configures keys (see `src/routes/+layout.svelte`).

If no provider has a key, `/chat` redirects to `/settings/keys` on mount.

## Providers and models

`src/lib/ai/providers.ts` is the single source of truth for supported providers:

- `id`, `label`, `protocol` (`'openai'` or `'anthropic'`), `baseUrl`, `defaultModel`, `models`
- `browserCompatible` — `false` for OpenAI (it blocks browser/CORS requests). Incompatible
  providers show a warning instead of a key input on `/settings/keys`.
- `docsUrl` — the "Get key" link
- `supportsModelsEndpoint` — `true` when the provider exposes an OpenAI-style `GET /models`
  endpoint for dynamic discovery (currently DeepSeek).

Current providers: Zhipu GLM (default `glm-4.7-flash`), DeepSeek, Anthropic, Groq, OpenRouter,
OpenAI. The Zhipu endpoint is the international `api.z.ai` one, not the China-only platform.

### Dynamic model discovery

`src/lib/ai/models.ts` (`loadModels`) refreshes a provider's `models` list from its
`GET /models` endpoint when `supportsModelsEndpoint` is set:

1. Return the cached list from `localStorage` (`faz:ai:models:<id>`) if fresh (<24h).
2. Otherwise fetch, parse via `parseModelIds` (pure, unit-tested), cache, and return.
3. On any failure (network, non-OK, unsupported provider), silently fall back to the curated
   static `models` list.

The chat page shows the static list immediately on provider switch, then kicks off `loadModels`
in the background so the dropdown refreshes when the call returns. `effectiveModel` validates a
stored model selection against the static list plus any cached live models, so a freshly
discovered id is accepted on the next visit.

### Key and model persistence

`src/lib/ai/keys.ts` stores keys and the last-used provider/model per provider in
`localStorage` only (never in PouchDB — keys must not sync). Keys:

- `faz:ai:key:<providerId>` — the API key
- `faz:ai:model:<providerId>` — the last-selected model for that provider
- `faz:ai:lastProvider` — the provider shown when the chat opens
- `faz:ai:models:<providerId>` — the cached live model list (24h TTL)

## Architecture (core/shell split)

The AI feature follows the project's FCIS pattern. Core modules are pure (values in, values
out, no I/O); shell modules do the fetching, DB access, and DOM work.

### Core (pure)

| File                     | Purpose                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protocol.ts`            | Request shaping for both protocols: `endpoint`, `buildHeaders`, `buildAgentBody`, `buildToolsParam`, `extractAssistantTurn`, `echoAssistantMessage`, `buildToolResultMessage`. Normalizes OpenAI/GLM vs Anthropic tool-calling and lifts the system message correctly for each. Also exports the `ChatMessage` / `ToolCall` / `AssistantTurn` types. |
| `context.ts`             | `buildBasePrompt(today)` (static identity, behavior, and writing rules) and `buildSystemContext(ctx)` (composes the base prompt plus the live snapshot). No DB access; takes the snapshot as a value.                                                                                                                                                |
| `tools/specs.ts`         | The tool catalog as JSON-Schema specs (`TOOL_SPECS`). Recurrence schemas are flat/wizard-style — friendlier to an LLM than the internal discriminated union.                                                                                                                                                                                         |
| `models.ts` (pure parts) | `parseModelIds`, `isCacheFresh`, `decodeCache` — the decision logic for caching/parsing. Unit-tested without touching the network.                                                                                                                                                                                                                   |
| `html.ts`                | `sanitizeHtml` is browser-only (DOMPurify), so it lives in the shell despite being a single pure-ish call. **Exception:** the file is classified as shell.                                                                                                                                                                                           |

### Shell

| File                | Purpose                                                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`         | `ChatError` (typed: `auth` / `rate` / `cors` / `network` / `http`) and `assertOk(response, provider)` that throws the right kind. The streaming helpers that used to live here were removed when agent mode became the only mode. |
| `models.ts` (shell) | `loadModels` — the `fetch`, cache read/write, and fallback.                                                                                                                                                                       |
| `context-gather.ts` | `gatherContext()` — runs the DB reads in parallel (`getVisibleTasks`, `getAllGoals`, `getUnprocessed`, `getAllCares`) and builds the `AgentContext` value (capped: 30 tasks, 10 cares) for the system prompt.                     |
| `agent.ts`          | `runAgent()` — the multi-turn tool-calling loop (see below).                                                                                                                                                                      |
| `tools/registry.ts` | `executeTool(name, args)` — runs each tool over the **same db repos the UI uses**, so ordering, goal-status, and recurrence logic stay consistent.                                                                                |
| `html.ts`           | DOMPurify sanitizer (browser-only).                                                                                                                                                                                               |

## The system prompt

Built fresh on every send by `buildSystemContext(await gatherContext())`. It contains:

1. **Base prompt** (`buildBasePrompt`) — Faz's identity, what Tasks/Goals/Cares/Inbox are, how to
   behave (capture passing thoughts into the inbox; act when the user wants to act), and a
   condensed version of [WRITING.md](./WRITING.md) (tone, word choices, brevity). It also tells
   the model to **always reply with HTML** using only `p/strong/em/ul/ol/li/br` — never markdown.
2. **Live snapshot** — today's date, active tasks (id, title, due, status), goals (id, title,
   status), cares (id, title, plan count), and the unprocessed-inbox count.

## The agent loop (`agent.ts`)

`runAgent` drives a multi-turn function-calling loop:

1. Build the request body via `buildAgentBody` (`stream: false` — agent rounds are non-streaming
   for reliable tool-call parsing) with `TOOL_SPECS` attached.
2. `fetch` the provider endpoint with `buildHeaders`.
3. Network errors are mapped to `ChatError`: a `TypeError` for an incompatible provider becomes
   `cors`; otherwise `network`. 401/429/other HTTP statuses are mapped by `assertOk`.
4. Parse the turn with `extractAssistantTurn` → `{ text, reasoning, toolCalls }`. If the model
   emitted reasoning (`reasoning_content` on OpenAI-protocol models, `thinking` blocks on
   Anthropic), it's appended and surfaced live via `onReasoning`.
5. If there are no tool calls, the turn's text is the final answer — delivered via `onText` and
   returned.
6. Otherwise: echo the assistant message back into the conversation, then execute each tool call
   via `executeTool`. Each result fires an `onTool` event (for the evidence log + Undo UI) and is
   appended as a tool-result message. The `AbortSignal` is honored between tool calls.
7. Repeat. Capped at `MAX_ITERATIONS = 8` rounds; on overflow the model is told
   _"I reached the action limit for one request — try narrowing it down."_

Reasoning and tool actions surface live through the callbacks even though the final answer
arrives whole. Streaming the final answer token-by-token was intentionally dropped when agent
mode became the only mode (commit `3d373d5`).

## Tools

Tools are defined in two files that must stay in sync:

- `tools/specs.ts` — the JSON-Schema the model sees.
- `tools/registry.ts` — the executor that runs against the db repos.

### Catalog (26 tools)

**Read** (no side effects):

- `list_tasks` (filter by `status` / `goalId` / `dueBefore`; capped at 50)
- `get_task`
- `list_goals`, `get_goal` (with its ordered task steps)
- `list_inbox` (unprocessed only)
- `list_cares`, `get_care` (plans include human-readable schedules via `describeRecurrence`)

**Tasks:**

- `create_task` (`title`, `doAt` ISO date, optional `goalId`, optional `originInboxItemId`)
- `update_task` (title and/or `doAt` only — **no `status` field**; use complete/uncomplete)
- `complete_task` — also calls `markPlanDone` when the task belongs to a recurring plan, and
  `recalcGoalStatus` when it belongs to a goal
- `uncomplete_task` — recalcs goal status
- `delete_task` (+ Undo)
- `convert_task_to_goal`, `convert_task_to_care` (+ Undo; recalc the source goal's status)

**Goals:**

- `create_goal` (optional `originInboxItemId`)
- `update_goal` (title and/or `status`)
- `delete_goal` (+ Undo)

**Cares (recurring):**

- `create_care` (optional `originInboxItemId`), `update_care` (rename), `delete_care` (+ Undo)
- `add_task_plan`, `update_task_plan`, `delete_task_plan` (+ Undo), `move_task_plan`
  - Each plan mutation runs `runSchedulerNow()` + `bumpTaskRefresh()` so generated tasks and the
    UI stay in sync with the UI's own care-editing paths.
  - Recurrence input is flat/wizard-style; the registry builds it via `buildRecurrence` and
    validates with `isValidRecurrence` from `engines/recurrence-wizard.ts`.

**Inbox (GTD capture → process loop):**

- `create_inbox_item` — capture a passing thought
- `mark_inbox_processed` — marks an item dealt with (after converting it into a task/goal/care
  with `originInboxItemId`, or just dismissing it). + Undo.

> There is intentionally **no hard-delete tool**. `delete_*` tools remove the doc and return an
> Undo closure; `mark_inbox_processed` is the only "dealt with" verb for inbox (the old
> duplicate `delete_inbox_item` was removed in commit `b55a14a`).

### Undo

`ToolResult.undo` is a closure `{ label, restore }` returned by the destructive tools. The chat
page keeps the closure in memory and the evidence chip renders an **Undo** button that calls
`restore()`. Snapshots come from `snapshotTask` (`utils/task-undo.ts`) and from the repos'
`restoreTask` / `restoreGoal` / `restoreCare` helpers.

### Why tool executors live in the shell

Tool executors read and write PouchDB, run the scheduler, and call `recalcGoalStatus` — all
shell concerns. They reuse the same repos as the UI on purpose: ordering decisions, goal-status
recalculation, and recurrence scheduling go through one code path whether the user or the AI
triggers them, so they can't drift.

Secondary updates (like `recalcGoalStatus` after `create_task`) are wrapped in
`.catch((e) => console.error(...))` so a secondary failure can't fail the whole tool call, but
the error still surfaces in the console.

## HTML sanitization

The base prompt instructs the model to reply with HTML. Assistant bubbles render that HTML via
`{@html sanitizeHtml(msg.content)}`. `sanitizeHtml` (`html.ts`) is a DOMPurify wrapper that
allows only `p/strong/em/ul/ol/li/br` and no attributes — no XSS surface. A scoped `.chat-html`
style restores basic paragraph and list typography that Tailwind Preflight resets.

Client-generated error messages and the reasoning `<details>` block stay plain text on purpose.

## The chat page

`src/routes/chat/+page.svelte` renders the conversation; `chat-page-state.svelte.ts` holds the
reactive state (Svelte 5 runes). Per turn:

1. Append the user message and an empty assistant placeholder
   (`{ content: '', reasoning: '', tools: [] }`).
2. Start an **idle timeout** (60 s with no activity). If it fires, the request is aborted and
   the turn becomes a friendly "taking too long" error — it can never spin forever on a stalled
   connection.
3. Build the system prompt from a fresh `gatherContext()` snapshot and call `runAgent` with
   `onReasoning` / `onTool` / `onText` callbacks that mutate the placeholder turn in place.
4. Errors become friendly assistant messages (via `friendlyError`) — no red alert bar.
   Error/history messages are filtered out of subsequent request history.
5. On finish, drop the placeholder if it stayed empty (e.g. the request was aborted immediately).

UI details:

- **Provider dropdown** — shown only when 2+ providers are configured.
- **Model dropdown** — shown only when the current provider offers 2+ models. Populated from the
  static list immediately, refreshed from `loadModels` in the background.
- **Reasoning panel** — a collapsible `<details>` labeled "Thinking…" while active, "Thought
  process" once content/tools arrive.
- **Evidence chips** — one per tool call, with an icon by action kind (`read`, `create`,
  `complete`, `uncomplete`, `update`, `delete`, `convert`, `move`). Destructive tools show an
  inline **Undo** button; after undo, an "Undone" label.
- **Stop** button replaces Send while streaming.

## Tests

- `__tests__/protocol.test.ts` — request shaping for both protocols.
- `__tests__/context.test.ts` — the base prompt's key phrases and snapshot composition.
- `__tests__/models.test.ts` — `parseModelIds`, `isCacheFresh`, `decodeCache`.

Run with `bun run test src/lib/ai`.

## Design mockups

`src/lib/ai/chat-designs.pen` holds the Pencil mockups the feature was designed against (chat
screens, model picker, agent-mode action log, delete undo). Treat them as reference, not spec —
the code is the source of truth.

## Commit history

The feature was built across ~30 commits with the `(ai)` tag. Key milestones:

- `f8617e8` — BYOK provider client library (protocol, client, keys, providers)
- `3ee954d`, `af02162` — API Keys page and chat page
- `57e0d53` — wire chat into navigation; root redirect
- `830e6dd`, `53a4672` — per-provider model lists and the model selector
- `0ec727a`, `664c563` — stream reasoning; friendly errors and the 60 s idle timeout
- `f34d1ee` — tool specs, context builder, and protocol shaping (core foundation)
- `762549a` — tool registry (executors over repos) + context gatherer
- `fea5bec` — the agent loop with tool execution
- `ad87743` — evidence log and delete undo in the chat UI
- `7a7a737`, `d7a0c97` — cares in agent context + cares write tools
- `2382b20` — inbox processing tools
- `cf3a21f` — task transformation tools
- `f4d4454`, `6b3b5e0`, `5465f22` — HTML system prompt + DOMPurify sanitizer + HTML bubbles
- `3d373d5`, `1b49aa0` — always run in agent mode; drop the streaming/toggle fork
- `c7c9e8e`, `9e06541`, `4551a9f` — correctness fixes (status field, goal recalc, error logging)
- `7df2707`, `2a50d77` — dynamic model discovery with static fallback
