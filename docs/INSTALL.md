# Installing Marasca

Marasca is free and isn't notarized by Apple (that needs a paid Apple Developer account). The app is **ad-hoc signed**, so macOS knows the files haven't been changed since the build. It just can't name a verified developer. You confirm it once, and after that it opens like any other app.

## First install

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

Download the new DMG and replace the app in Applications. macOS asks you to confirm each new version once, the same way.

## "Marasca is damaged and can't be opened"

That message means the app's signature doesn't match its files. Usually the download was corrupted, or the build wasn't signed. Download it again. If it keeps happening, please open an issue.

## For maintainers

- `build.mac.identity` is `"-"` (ad-hoc). It is free, and on Apple Silicon it turns _"damaged"_ into the recoverable _"could not verify"_ prompt above.
- `hardenedRuntime` is off. With an ad-hoc identity it breaks library validation for Electron's frameworks, and it only matters for notarization.
- Check a build with `npm run verify:sign`.
- To notarize later (Apple Developer Program, $99/yr): set `identity` to the _Developer ID Application_ certificate, turn `hardenedRuntime` back on, add entitlements, and set `notarize: true`. Auto-update (Squirrel.Mac) also needs that.
