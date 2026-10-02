# Installing Marasca

Marasca is free and isn't notarized by Apple (that needs a paid Apple Developer account). The app is **ad-hoc signed**, so macOS knows the files haven't been changed since the build. It just can't name a verified developer. You confirm it once, and after that it opens like any other app.

## One command (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/NouranAlSharawneh/vault/main/install.sh | bash
```

This downloads the newest release's DMG, checks it against the release's `SHA256SUMS.txt`, copies Marasca into `/Applications` (quitting a running copy first) and opens it. Because the script installs the app itself, macOS doesn't show the "could not verify" prompt. Run the same command to update.

- Install a specific version: `curl -fsSL https://raw.githubusercontent.com/NouranAlSharawneh/vault/main/install.sh | MARASCA_VERSION=0.0.1 bash`
- Read the script before running it: [install.sh](../install.sh)

## First install (by hand)

Marasca needs macOS 13 (Ventura) or later on an Apple Silicon Mac (M1 or newer).

1. Download `Marasca-<version>-arm64.dmg` from the [Releases page](https://github.com/NouranAlSharawneh/vault/releases).
2. Open the DMG and drag **Marasca** into **Applications**.
3. Open Marasca from Applications. macOS says it _"could not verify Marasca is free of malware"_. Click **Done**. Don't click Move to Trash.
4. Open **System Settings ▸ Privacy & Security**, scroll to **Security**, and click **Open Anyway** next to _"Marasca was blocked…"_. Confirm with your password or Touch ID.
5. Marasca opens. You won't be asked again for this version.

On macOS 15 (Sequoia) and later, Control-click ▸ Open no longer skips this prompt. Step 4 is the way.

### Terminal alternative

```bash
xattr -dr com.apple.quarantine /Applications/Marasca.app
```

This removes the "downloaded from the internet" flag, so the prompt never appears. Only do this for a DMG you downloaded from the Releases page above.

## Updating

From 0.0.5 on, Marasca updates itself. When a new version is out, the Settings gear gets a dot. Click **Update to X** in Settings ▸ Updates, or **Update and Restart** in Marasca ▸ Check for Updates…. Marasca then:

1. downloads the new version's DMG from the release and checks it against the release's `SHA256SUMS.txt`;
2. copies the new app out of it, and checks that it is Marasca, the version asked for, with a signature that matches its files;
3. quits, the same way as ⌘Q, so anything waiting to be pushed is pushed first. Editor windows with unsaved changes ask first. If you keep one open, the update stops, and the next click skips the download;
4. swaps the new app in where the old one was, and reopens it.

macOS doesn't show the "could not verify" prompt for an update, because Marasca downloaded it itself.

After an update, macOS may ask once whether Marasca can use **"Marasca Safe Storage"** in your keychain. That's where your GitHub sign-in is encrypted. Click **Always Allow**. It asks because every build has its own ad-hoc signature. A Developer ID signature would stop it (see below).

**When Marasca can't replace itself, it opens the download page instead and says why.** That happens when:

- the app is in a folder you can't write to without an administrator;
- it is running from the DMG or from a temporary copy macOS made.

Then update the old way: run the one-line install again, or download the new DMG and replace the app in Applications. The swap writes what it did to `~/Library/Logs/Marasca/update.log`.

Before 0.0.5, there is no in-app update. Use the one-line install, or download the DMG and replace the app.

## "Marasca is damaged and can't be opened"

That message means the app's signature doesn't match its files. Usually the download was corrupted, or the build wasn't signed. Download it again. If it keeps happening, please open an issue.

## For maintainers

- `build.mac.identity` is `"-"` (ad-hoc). It is free, and on Apple Silicon it turns _"damaged"_ into the recoverable _"could not verify"_ prompt above.
- `hardenedRuntime` is off. With an ad-hoc identity it breaks library validation for Electron's frameworks, and it only matters for notarization.
- Check a build with `npm run verify:sign`.
- To notarize later (Apple Developer Program, $99/yr): set `identity` to the _Developer ID Application_ certificate, turn `hardenedRuntime` back on, add entitlements, and set `notarize: true`. Squirrel.Mac (`electron-updater`) also needs that, which is why Marasca has its own updater.
- **The in-app update reads two files from each release:** `Marasca-<version>-arm64.dmg` and `SHA256SUMS.txt`, both uploaded by `release.yml`. A release without either can't be installed from inside the app.
