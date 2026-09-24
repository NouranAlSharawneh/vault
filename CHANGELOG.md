# Changelog

All notable changes to Marasca. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: add a section for the new version here, run `npm run release -- <patch|minor|major>`, then `git push --follow-tags`. The tag builds the DMG and opens a draft release with this section as its notes.

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
