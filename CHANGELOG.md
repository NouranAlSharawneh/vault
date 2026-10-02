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
- **Dropping a file on a window no longer replaces the app with the file.** Windows stay on Marasca, links only open web and mail addresses, and only Marasca's own page can talk to the app.
- **The capture shortcut can't take over ordinary typing.** It needs ⌃ or ⌘ (⌥Space and function keys still work), ⇧⇥ leaves the recorder instead of becoming the shortcut, and the recorder says why a combination was refused. Pressing the same shortcut again retries it once the other app lets go.
- **⌘, and ⌘K work from any window,** and the capture shortcut with no vault open shows the vault's own screen instead of starting setup over.
- **Settings:** an error shows under the setting that failed, a changed shortcut is confirmed, Esc or ⌘[ goes back, an expired session offers "Sign in again", the repository dot follows the sync state, pasted tokens aren't described as never expiring, and emptying the trash says plainly that earlier versions stay in git history.
- **Reset asks every open document about unsaved changes first,** pushes what's waiting, and lists what it forgets.
- **Signing in with GitHub:** cancelling and starting again no longer opens two browser tabs, "Approved" keeps a spinner until you're signed in (and says so if that fails), the countdown stops when the code is used or expires, and signing in again resumes pushing straight away.
- **Setup:** "Start local" means local even when you're signed in, a folder you picked stays picked, a repo name you already own is offered instead of failing, public repos are flagged before you capture into them, and a mistyped token gets a plain explanation. Signing in from Settings leads to the repo picker (or straight back to the vault when it's already connected), and you can Cancel back to your vault at any step.
- The update check tells "rate limited" from "offline", and knows a beta comes before its release.
- Settings are written so a crash can't leave half a file, and an unreadable one is kept as `config.json.bak`.
- The error screen can be dragged, copied from, and — off the main page — left for the vault.
- **The document list works from the keyboard.** It is one Tab stop: ↑/↓, Home/End and Page Up/Down move through it, Enter (or a double-click) opens the document in the editor, and the selected row stays in view — including after ⌘K, a link or a capture selects something far down the list.
- **Recent respects the tags you've turned on**, like every other list.
- **Settings and back no longer resets the library.** The selected document, filter, sort, reader view and scroll are where you left them; sort and view are remembered across launches.
- **Moving a document to the trash selects the next one** instead of leaving the reader blank, and the reader keeps the last document up while the next one loads rather than flashing "Select a document". A document that can't be read says so, with Try again.
- **Trash has a place in the sidebar** once something is in it.
- **The title bar can drag the window from anywhere empty**, and at the narrowest window size the search field shrinks instead of pushing New off the edge.
- **The sync badge does what it says:** it pushes when something is waiting, pulls when GitHub has changes, sends a signed-out account to sign-in and a read-only repo to the repo picker, answers every click, and is plain text when there's nothing to do.
- **⌘K:** the highlighted result stays in view, titles match as you type, filters apply before results are cut to the top hundred, Enter no longer fires mid-IME composition, and Esc no longer closes the conflict sheet underneath.
- **Shortcuts don't reach the library while a dialog is open** — ⌘⌫ from the conflict sheet no longer trashes the document behind it.
- **Resolving conflicts is one at a time**, errors clear themselves, and the sheet closes when the last pair is settled.
- **Links in documents:** `other.md#section` opens at that section, `<a name>` anchors work, links inside trashed documents resolve, and Open on GitHub is encoded and waits until the document has been pushed.
- **A playing video no longer restarts** whenever a push or a star updates the library.
- History shows what a moved document's commit really changed, keeps working when one diff can't be read, and its times stay current.
- Titles sort naturally (Doc 2 before Doc 10), the tag filter ignores case, more than 40 tags get "Show all", and the rail scrolls past its ninth project.
- `created:2026-03-14` means that day in your time zone; `created:>1` no longer means 2001.
- The split between list and reader can be moved with the arrow keys, remembers a double-click reset, and stays within sensible widths.
- **Capture waits for its images.** ⌘↵ pressed while the images were still being looked for committed broken links without a warning; it now waits up to three seconds, then says what's missing.
- **A capture saved after Esc stays out of the next one.** A late save no longer shows "Committed" with the old path over a new clip and then hides it.
- **Every clip starts fresh.** A folder picked or a file skipped for one capture no longer carries over to the next, and the first capture after launch reads the clipboard of the moment, not the one from launch.
- **⌘↵ in Project or Tags saves what you typed.** A new project called "API" no longer becomes "Atlas API", a new tag `api` can be added when `api-design` exists, and a project typed in a different case joins the existing one instead of renaming it. The suggestions open below the field, inside the sheet.
- **Images in a captured README are found where they are.** `./img.png` resolves, image links inside code blocks are left alone, a link that leaves the folder (`../../secret.pdf`) is flagged and never copied, a bare file name found somewhere on the disk is only a suggestion, and one Spotlight search failing no longer hides the others. Files over the size warning are left out unless you include them.
- **The capture title** skips headings inside code blocks, reads an HTML `<h1>`, and keeps a leading number ("3D printing", not "D printing").
- "detected" appears next to the source only when Marasca recognised one, and a GitHub page about OpenAI counts as GitHub.
- A failed capture can be retried with ⌘↵ or Try again, and its error can be read in full. A Finder file over 2 MB isn't read whole, and a very long clip previews its first 300 lines.
- **An open document moved to the trash says so** in its editor, instead of a save quietly bringing it back.
- **Unsaved text older than the file is offered, not restored.** Restoring it silently let the next save overwrite whatever had changed the file since (a pull, another editor).
- **Save errors are in plain words** on a row of their own ("Marasca isn’t allowed to write to the vault folder"), with git's message on hover. The Save button names the branch it commits to.
- Esc in the title, project or tag field no longer closes the editor.
- Long documents stay quick to type in: the preview, word count and image check catch up once you pause.
- Drafts are written so a crash can't leave half a file.

### Added

- **⌘S saves and keeps the editor open.** The footer then says "Saved"; ⌘↵ still saves and closes.
- **Find and replace in the editor** (⌘F, then ⌘G for the next match), with other copies of the selected word highlighted.

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
