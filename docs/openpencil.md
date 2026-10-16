# Design mockups (OpenPencil)

Mockups are [OpenPencil](https://github.com/zseven-w/openpencil) documents in `design/` (plain
JSON, one page per area). They are reference, not spec: the code is the source of truth.

- `design/faz.op` — mockups of the current app (DaisyUI look), described below.

### `design/faz.op`

| Page             | Covers                                                          |
| ---------------- | --------------------------------------------------------------- |
| AI chat          | Chat screens, model picker, agent mode, API keys, top bar, dock |
| Focus mode       | Focus mode scheduling, day picker and time picker modals        |
| Wheel select     | `wheel-select.svelte` and its demos                             |
| Navigate (admin) | `/navigate` page: badges, cards, the four tabs                  |

New areas get a new page (`op --port 3101 page add --name "..."`), not a new file.

## Prerequisites

`op` and `openpencil-desktop` (0.8.4) come from the system profile (NixOS), not from the repo. The
agent skill is a user-level Claude Code plugin: `op install --target claude`, then
`claude plugin enable openpencil-skill@openpencil-skill`. If `claude plugin list` shows
"failed to load" (marketplace cache-miss), copy
`~/.claude/plugins/cache/openpencil-skill/openpencil-skill/<version>` to
`~/.claude/plugins/marketplaces/openpencil-skill`.

Fonts ship with the repo: `design/fonts/` holds static TTFs (Inter, Archivo, Archivo
ExtraCondensed) and a self-contained `fonts.conf`; the scripts point OpenPencil at it through
`FONTCONFIG_FILE`, so nothing needs installing. Add a family as static TTFs, one file per weight
and style, in `design/fonts/files/<Family>/` (variable fonts render 600/700 wrongly). A family
missing from that folder falls back to Roboto.

## Commands

Faz's editor runs on port **3101**. Other projects (e.g. Lopy) use OpenPencil on port 3100.

- `bun run design [file]` — headless editor on `design/faz.op` (or the given file). Every edit
  is written to the file immediately.
- `bun run design:gui [file]` — editor window (live canvas) on the same port. It does not
  autosave: save in the app before closing. Only one OpenPencil window can exist per desktop;
  opening a second one replaces the document in the first, so the script refuses while one is
  open.
- `bun run design:wrap` — pre-breaks wrapped text in the running editor so exports draw it right
  (see quirks). Run it after editing text, before saving or exporting.
- `bun run design:stop` — kills the editor on port 3101.
- `bun run design:export [dir]` — renders every page of every `design/*.op` in the `light` and
  `dark` themes to `/tmp/faz-design/<file>/<theme>/page<N>/` (default dir) from temporary
  copies, so the design files are not touched.

Drive the editor with `op --port 3101 <command>` (`op --port 3101 tools` lists all 166 tools).

## Rules for agents

The `openpencil-skill:openpencil-design` skill documents the node schema and batch DSL. Where it
disagrees with this list, this list wins:

- Pass `--port 3101` to every `op` command. Bare `op` talks to whichever editor was started last, or port 3100 (another project).
- Never run `op start` or `op stop`. They ignore `--port` and act on whichever editor was
  started last, which can close another project's editor. Use the `bun run design*` scripts.
- Don't use the `openpencil` or `pencil` MCP tools from a Faz session: `openpencil` points at
  another project's editor on port 3100 and `pencil` is a different app (pen.dev).
- `op insert` returns no node id. Use `op --port 3101 design '<dsl>'`, which does, or look nodes
  up with `op --port 3101 get --name <name>`.
- Check work visually: `bun run design:export`, then read the PNGs.
- Implement in Svelte 5 + DaisyUI + `lucide-svelte` by hand. OpenPencil's code generation is
  reference only.

## Colors and tokens

These are `design/faz.op`'s tokens. Use variables, never hex, so mockups follow the theme. Names mirror DaisyUI (Tailwind class
without the `bg-`/`text-` prefix) and the theme axis `theme` has the variants `light` and `dark`:

- `base-100/200/300`, `base-content`, `primary`, `secondary`, `accent`, `neutral`, `info`,
  `success`, `warning`, `error`, each with `-content`.
- `base-content-flat/10…60` — solid versions of `text-base-content/NN` (muted text, dividers).
  `base-content/NN` (real alpha) only for text.
- `primary-flat/10`, `success-flat/10`, `warning-flat/10`, `info-flat/10`, `error-flat/10` — soft
  status backgrounds.
- `radius-box`, `radius-field`, `radius-selector`, `border` — numbers for reference;
  `cornerRadius` and stroke width cannot bind to variables, so type the number.

The design-system summary is stored in the document (`op --port 3101 get_design_md`).
Provider brand colors, modal scrims and the sticky note are the only intentional hex values.

## OpenPencil 0.8.4 quirks

- In a `layout: "none"` frame the **first** child is drawn on top (Pencil and the DOM draw the
  last one on top). List overlays topmost-first.
- `enabled: false` does not hide a node. Use `visible: false`, which still takes layout space.
- Translucent fills on shapes and frames render lighter than their alpha (alpha is applied
  twice): a `#00000066` scrim looks like 16%, not 40%. Text alpha is correct.
- Exports break wrapped lines with OpenPencil's built-in Roboto metrics, whatever the font, while
  layout measures the real font. Wider fonts (Inter, Archivo) then run past their box. Explicit
  line breaks are honoured, so `bun run design:wrap` (`design/tools/opwrap.py`) inserts them for
  every fixed-width text node; it is idempotent.
- Avoid live component instances (`ref`): their size is ignored in layout. The migrated mockups
  use detached copies.
- `descendants` overrides must use fill arrays (`[{ "type": "solid", "color": … }]`); one bare
  string fill makes the instance drop every override.
- `rename_page` fails on the headless editor; name pages when adding them.
