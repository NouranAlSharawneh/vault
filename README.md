# Marasca

<img src="docs/brand/marasca-lockup.svg" alt="Marasca" width="420">

A macOS desktop app that catches every markdown file you'd hate to lose and commits it straight to a GitHub repository you own. **No database, no account, no lock-in** — the git repo _is_ the database.

## Install

Paste this into Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/NouranAlSharawneh/vault/main/install.sh | bash
```

It downloads the latest release, checks its checksum, installs **Marasca** into `/Applications` and opens it. Run it again any time to update. You need macOS 13+ on an Apple Silicon Mac.

If you'd rather install by hand, download the `.dmg` from [Releases](https://github.com/NouranAlSharawneh/vault/releases/latest). [docs/INSTALL.md](docs/INSTALL.md) has the walkthrough.

- ⌃⌥V anywhere → clipboard captured → tagged → committed to `main` in under five seconds.
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
npm run dist       # ad-hoc signed .dmg into release/ (not notarized)
npm run verify:sign  # check the built app's signature (macOS)
```

GitHub auth: the OAuth device flow ("Continue with GitHub") when `MAIN_VITE_GITHUB_CLIENT_ID` is set at build time — register a free OAuth App at github.com/settings/developers and tick **Enable Device Flow** — or a pasted fine-grained personal access token (Contents: read/write on the vault repo). Only the client ID is ever used. Never put the client secret in `.env`: anything in the build can be read back out of the `.app`, and the device flow doesn't need it.

## Releasing

1. Add a `## [x.y.z] - YYYY-MM-DD` section to [CHANGELOG.md](CHANGELOG.md).
2. On a clean `main`, run `npm run release -- patch` (or `minor`, `major`, `x.y.z`, or `current` to tag the version already in `package.json`).
3. Run `git push --follow-tags`. The **Release** workflow checks that the tag matches `package.json`, runs the checks, builds the ad-hoc signed DMG on an Apple Silicon runner, and opens a **draft** release with the changelog section as notes.
4. Review the draft on GitHub and click **Publish**.

The build takes the client ID from the Actions variable `MAIN_VITE_GITHUB_CLIENT_ID`. Without it, the app offers only the paste-a-token sign-in.

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
npm run reset       # wipe app data (settings, token, cache) → next launch starts at onboarding
```
