# Vault — Architecture

> Desktop app that captures markdown and commits it straight to a GitHub repo you own. No database, no server, no account beyond GitHub. Everything free.

## 1. Stack (all free / OSS)

| Layer     | Choice                                                                   | Why                                                                                                                         |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Shell     | **Electron 44** + **electron-vite 5**                                    | All-JS, built-in `globalShortcut`, `clipboard`, `safeStorage` (Keychain-backed on macOS), `Tray`. No Rust toolchain needed. |
| UI        | **React 19 + TypeScript**, **Tailwind v4**, `lucide-react` icons         | Fast to iterate, matches the team's skills.                                                                                 |
| State     | **zustand**                                                              | Tiny, no boilerplate, works well with IPC-fed stores.                                                                       |
| Editor    | **CodeMirror 6** (`@codemirror/lang-markdown`)                           | Lightweight, keyboard-first, markdown-aware.                                                                                |
| Preview   | `react-markdown` + `remark-gfm` + `shiki` (code) + `mermaid` (diagrams)  | Renders client-side; file on disk stays plain text.                                                                         |
| Search    | **MiniSearch** (in-memory)                                               | Full-text + field boosting over ~5k docs in ms; disposable index.                                                           |
| Git       | **simple-git** wrapping the system `git`                                 | Free, no libgit2 build step. Requires git on PATH (macOS ships it via Xcode CLT).                                           |
| Metadata  | `yaml`                                                                   | Trailing fenced YAML block; tolerant parse, stable key order on write.                                                      |
| Watcher   | `chokidar`                                                               | Picks up edits made in Obsidian/vim/github pulls.                                                                           |
| Secrets   | Electron `safeStorage` → encrypted blob in `userData`                    | Uses macOS Keychain for the key; no `keytar` (unmaintained).                                                                |
| Tests     | vitest (core logic), Playwright + Electron (smoke)                       |                                                                                                                             |
| Packaging | electron-builder (dmg, unsigned for now — signing costs $99/yr, skipped) |                                                                                                                             |

## 2. Code conventions

- **Formatting / linting**: Prettier (double quotes, semicolons, 100 cols, Tailwind class sorting) + ESLint flat config (typescript-eslint strict, react-hooks, react-refresh). Husky pre-commit runs lint-staged → typecheck → tests.
- **TypeScript**: strict, no `any`, unused locals/params are errors, `noImplicitReturns`, no deprecated options (no `baseUrl`; `paths` are relative to the tsconfig).
- **Tailwind v4**: only canonical utilities. Every size/colour/radius/shadow is a token in `global.css` `@theme`, so there are no `[arbitrary]` values.
- **Folders**
  - `src/shared/` — `types.ts` (cross-process domain types), `constants/` (one file with every constant), `helpers/` (one function per file), `frontmatter/`, `query/`, `ipc/`.
  - `src/main/` — `index.ts` (lifecycle only), `app/<name>/` (session, ipc, hotkey, menu, tray), `network/axios/` (instance + request/response interceptors + `NetworkError`), `network/github/` (one call per file), `services/<name>/` (git, indexer, vault, capture), `store/`, `windows/`, `data/` (static menu/tray data).
  - `src/renderer/` — `app/`, `routes/<name>/` (thin) → `features/<name>/` (`<name>.component.tsx`, `<name>.types.ts`, `hooks/`, `components/<child>/`), `components/ui/<name>/`, `stores/<name>/`, `helpers/`, `constants/`, `data/`, `lib/api/`.
  - Types live beside the file that owns them (`*.types.ts`); only truly shared types go in `src/shared/types.ts`.
  - `tests/` at the repo root mirrors `src/` (`tests/shared/…`, `tests/main/services/…`, `tests/smoke/`).

## 3. Process model

```
┌──────────────── main (Node) ────────────────┐
│ vault/       scanner, index cache, watcher   │
│ git/         simple-git wrapper, push queue  │
│ github/      PAT validation, device flow,    │
│              repo list/create (REST, fetch)  │
│ secrets/     safeStorage token store         │
│ windows/     main, capture sheet, tray       │
│ ipc/         typed handlers (contextBridge)  │
└──────────────┬───────────────────────────────┘
               │ typed IPC (invoke/handle + push events)
┌──────────────┴───────────────────────────────┐
│ preload      exposes `window.vault.*` API    │
├──────────────────────────────────────────────┤
│ renderer (React)                             │
│  routes: onboarding · main (3-pane) · editor │
│          capture-sheet · settings            │
│  stores: docs · ui · sync · auth             │
└──────────────────────────────────────────────┘
```

Rules:

- Renderer never touches `fs`, `git`, or the network. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- All shared types live in `src/shared/` (frontmatter schema, IPC contract, query grammar AST).
- Main pushes `index:changed`, `sync:status`, `auth:expired` events; renderer subscribes once.

## 4. Data model — the file _is_ the record

Content first, metadata last. Vault writes its fields as a fenced YAML block at the **end** of the
file under a rule, so GitHub's preview shows the document itself first and the fields as a small
code block below it (a head `---` block would render as a table above the title).

````markdown
# Rate limiting at the edge

We currently rate-limit inside the application layer…

---

```yaml
title: Rate limiting at the edge
project: Atlas API
tags: [spec, infra]
created: 2026-09-09T14:22:10Z
source: claude # claude | chatgpt | github | manual | other
starred: true # omitted when false
```
````

Files with classic head frontmatter (Obsidian, Jekyll, older Vault files) are still read; they move
to the trailing layout the next time Vault saves them. Parsing only touches the two ends of the
file: a small file is read whole, a big one reads the head (excerpt, legacy block) and the last 4 KB.

Images and media referenced from a doc (`![hero](assets/hero.png)`) resolve GitHub-style against the
doc's folder and load through the app's `vault://asset/<path>` protocol, which serves known media
types from inside the vault only. `https:` images load directly.

Repo layout: `README.md` (generated index), `<project-slug>/<title-slug>.md`, `_inbox/` for no-project docs, `.trash/` (scanner skips), `.vault/views.yml`, `.vault/templates/`.

## 5. Index & cache (D3 from the PRD)

- **Cold start**: walk `*.md`, read only the ends of each file (trailing metadata block, or a legacy head block), build `DocMeta[]`. Body text indexed lazily in a background pass in chunks of 50 files via `setImmediate`.
- **Warm start**: load `~/Library/Application Support/Vault/index-<repoId>.json` `{ headSha, files: {path: {mtime,size,meta}} }`, then `git diff --name-status <headSha> HEAD` + a stat pass for uncommitted edits; re-parse only those.
- **Live**: chokidar on the vault folder (ignoring `.git`, `.trash`), debounced 300 ms, plus `Rescan` action.
- Cache is disposable; deleting it costs one cold scan. Nothing lives there that isn't derivable from the repo.

## 6. Save path (M2)

1. Compose body → rule → fenced YAML metadata block.
2. Path = `<project-slug>/<title-slug>.md`, de-dup with `-2`, `-3`.
3. `git add` + `git commit -m "add: <title>"`.
4. Regenerate `README.md`, `git commit --amend --no-edit`.
5. Update in-memory index immediately (UI reflects without rescan).
6. Push on a **3 s debounce** (Q6 resolved). On failure the commit stays local; doc shows amber "not pushed"; push queue retries with backoff and on network regain. `git status -sb` ahead-count drives the badge.

## 7. Auth

- **v1 path**: paste a fine-grained PAT (Contents: read/write on the vault repo). Validated via `GET /user` + `GET /repos/:owner/:repo`. Stored via `safeStorage`.
- **Device flow**: implemented behind `GITHUB_CLIENT_ID` in `.vault-config`/env; lights up once an OAuth App is registered (free). Polls `/login/oauth/access_token`, handles `authorization_pending`, `slow_down`, `expired_token`, `access_denied`.
- Git push uses the token via a per-command `http.<remote>.extraheader` (basic `x-access-token:<token>`), never written to `.git/config`.
- Any 401 → `auth:expired` → re-auth screen; unsaved editor state kept in the renderer.

## 8. Windows

- **Main** (3-pane, sidebar states full/rail/hidden via `⌘\`).
- **Capture sheet**: frameless, always-on-top, `vibrancy`, centred on active display; `globalShortcut('Control+Alt+V')`, reads clipboard on show, `⌘↵` saves, `Esc` hides. Hidden, not destroyed — shows in <50 ms.
- **Tray** icon with sync status (green/amber) + quick actions.

## 9. Decisions I'm making beyond the PRD

- Delete = `git mv` into `.trash/` + commit (Q5). Purge from settings.
- Push cadence = commit now, push on 3 s debounce (Q6).
- Tailwind + CSS variables for the palette; fonts: Geist / Geist Mono / Newsreader loaded locally (OFL, free).
- Search grammar parsed into an AST (`project:`, `tags:`, `created:`, `source:`, `is:`) and applied as MiniSearch filters, so saved views are just query strings.
- Project colours derived deterministically from slug hash (no state to store).

## 10. M5 scope

- **History drawer** (`git log --follow` per doc, diff view, restore), **conflict sheet** (mine / theirs / both), **saved searches** (`.vault/views.yml`), **templates**, project rename, trash + purge, **Settings** (hotkey, push debounce, vault folder).
- **Asset capture.** The clipboard carries text only, so relative images in a captured doc (`![…](docs/hero.gif)`) can't resolve on their own. Two inputs, one core:
  1. Text capture that references relative images: the sheet shows "N images referenced — choose the folder they're relative to", remembers the folder per source project, and on save copies the files into `<project>/assets/`, rewrites the links, and commits doc + assets in one commit.
  2. A `.md` file copied in Finder or dropped onto the sheet (`public.file-url`): the path is known, so images next to it resolve with no prompt.
  - Guardrails: warn before committing any asset over 10 MB (GitHub refuses >100 MB; git never forgets); remote `https:` images are left as links by default (vendoring is opt-in).

## 11. Risks & how they're handled

| Risk                                                  | Mitigation                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Unsigned macOS build shows Gatekeeper warning         | Dev via `npm run dev`; ship dmg with "right-click → Open" note. Signing = $99/yr, out of scope.                             |
| `git` missing on user machine                         | Detect on launch; show one-screen instruction (`xcode-select --install`).                                                   |
| Global hotkey conflicts (Raycast/Alfred own `⌥Space`) | Default is `⌃⌥V`, which nothing common claims; configurable in settings.                                                    |
| Push conflict (two machines)                          | Fetch before push; on non-fast-forward, `pull --rebase`; per-file conflicts surface the "Yours / Remote / Keep both" sheet. |
| Large vault (5k files) cold scan                      | Ends-of-file read + lazy body pass; measured target <1 s for 5k.                                                            |
| Token leakage                                         | Never in repo, never in logs; `safeStorage`; redact in error messages.                                                      |
| Mermaid render errors on bad diagrams                 | Render in try/catch, show code block with error line.                                                                       |
| Clipboard not markdown                                | Heuristic detector (headings/fences/lists); still allow capture, source = `other`.                                          |
| Electron memory footprint                             | Single renderer, capture sheet reuses hidden window.                                                                        |
| Filename collisions / unicode titles                  | Slugify with transliteration, dedup suffix.                                                                                 |
