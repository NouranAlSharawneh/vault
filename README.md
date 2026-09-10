# Vault

A macOS desktop app that catches every markdown file you'd hate to lose and commits it straight to a GitHub repository you own. **No database, no account, no lock-in** — the git repo _is_ the database.

- ⌥Space anywhere → clipboard captured → tagged → committed to `main` in under five seconds.
- ⌘K finds any document by title, frontmatter or body text.
- Every save is a commit, so version history and restore come for free.
- The vault stays fully usable if this app disappears: it's just `.md` files with YAML frontmatter.

## Stack

Electron 44 · electron-vite · React 19 · TypeScript · Tailwind v4 · CodeMirror 6 · simple-git · MiniSearch. Everything free and open source.

## Development

```bash
npm install
npm run dev        # launches Electron with hot reload
npm run typecheck
npm test
npm run dist       # unsigned .dmg into release/
```

GitHub auth: paste a fine-grained personal access token (Contents: read/write on the vault repo). OAuth device flow is built in and activates when `VAULT_GITHUB_CLIENT_ID` is set (register a free OAuth App at github.com/settings/developers and enable Device Flow).

## Repo layout of a vault

```
README.md            # auto-generated index, regenerated each commit
atlas-api/           # one folder per project, slugified
  rate-limiting-at-the-edge.md
_inbox/              # docs saved with no project
.trash/              # deleted docs (scanner skips; still in git history)
.vault/
  views.yml          # saved searches
  templates/         # frontmatter starters
```

See `ARCHITECTURE.md` for the full design and code conventions.

```bash
npm run lint        # eslint
npm run format      # prettier
npm run smoke       # headless Electron walk-through (needs xvfb)
```
