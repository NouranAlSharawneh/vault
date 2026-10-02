# Changelog

All notable changes to Marasca. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: add a section for the new version here, run `npm run release -- <patch|minor|major>`, then `git push --follow-tags`. The tag builds the DMG and opens a draft release with this section as its notes.

## [Unreleased]

### Fixed

- **Opening a document no longer marks it as changed.** Every document used to open with the unsaved dot, ask about unsaved changes on close, and park a copy of itself as a draft — which could overwrite the text a crash had left behind. ⌘Z straight after opening no longer empties the document.
- **Typing while a save is on its way can't be lost.** The editor holds the text still until the save comes back.
- **A save that lands on a newer version says so,** and keeps a star you added from the main window while the document was open, instead of quietly putting the old one back.
- **A commit that fails after the file is written no longer leads to a duplicate.** Try again carries on with the same file.
- **Images already in a document aren't copied in again** as `hero-2.png` on every save.
- **Files with odd metadata keep all their text.** A note that ended on a YAML example, or had a broken metadata block, used to lose everything after the `---` on its next save. Tags with `[`, `]` or `,` in them no longer break the metadata, and a missing created date is no longer stamped 1970.
- **Titles and projects in any script get their own folder.** Russian, Chinese, Hebrew or Greek names all came out as `untitled`, and two such projects shared one folder.
- **Saves, pulls and pushes take turns.** A save during a pull could be folded into another commit, and a push landing mid-save rewrote a commit already on GitHub.
- **A pull over an edit you hadn't committed keeps both versions.** It used to leave conflict markers in the file and stop every later commit.
- **Setting up with a repo you already use is safe.** A failed clone (offline, wrong folder) is reported instead of turning the chosen folder into an empty vault, a folder that belongs to another repo is refused, and a README Marasca didn't write is never replaced by its index.
- **Restoring an old version restores its text only** — today's title, project, tags and star stay.
- **Quitting pushes what's waiting** instead of leaving the last few seconds of saves on this Mac.
- **The sync badge recovers by itself** once the network is back, and says when GitHub refused a commit (a secret it recognised, or a file over 100 MB) instead of retrying for ever. Files over 100 MB are never copied into the vault.
- **History and restore work for documents with non-Latin titles.**
- Notes in nested folders, or at the top of the vault, stay where they are when saved or starred.
- A crash that left git's lock file behind no longer blocks every save.
- Resolving a conflict can't send both versions to the trash.

## [0.0.2] - 2026-09-28

### Fixed

- **Move to trash only works once per click.** The button spins and stays disabled until the document is in the trash, so a double-click or a repeated ⌘⌫ no longer ends in an error. Restore and Delete forever work the same way.
- **Lists in documents show their bullets and numbers again**, nested lists included, the way GitHub draws them. Task lists keep just their checkboxes.

## [0.0.1] - 2026-09-24

First public build. macOS 13+ on Apple Silicon.

### Added

- **Capture from anywhere:** ⌃⌥V grabs the clipboard, tags it and commits it to your GitHub repo in seconds.
- **Library and search:** ⌘K finds any document by title, frontmatter or body text. Projects and tags.
- **Editor:** markdown with live rendering and Mermaid diagrams. Every save is a commit.
- **History and conflicts:** browse and restore any version, and review conflicts side by side before anything is overwritten.
- **Sign in with GitHub** using a device code, or paste a fine-grained token. No password ever goes into the app, and the token lives in your macOS Keychain.
- **Start local, connect later:** use it without GitHub and add a remote when you're ready.

### Notes

- The app is ad-hoc signed, not notarized. macOS asks you to confirm it once. See [INSTALL.md](https://github.com/NouranAlSharawneh/vault/blob/main/docs/INSTALL.md).
- Needs git installed (`xcode-select --install`).
