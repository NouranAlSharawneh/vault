#!/usr/bin/env bash
# Install or update Marasca from the latest GitHub release.
#
#   curl -fsSL https://raw.githubusercontent.com/NouranAlSharawneh/vault/main/install.sh | bash
#
# Options (environment variables):
#   MARASCA_VERSION=0.0.2   install that version instead of the newest
#   MARASCA_DIR=~/Applications   install somewhere other than /Applications
#
# What it does: finds the release's arm64 DMG, checks it against the release's
# SHA256SUMS.txt, copies Marasca.app into /Applications (quitting a running copy first),
# and clears the download quarantine flag so macOS opens it without the "could not
# verify" prompt. The app is ad-hoc signed, not notarized: see docs/INSTALL.md.
set -euo pipefail

REPO="NouranAlSharawneh/vault"
APP="Marasca"
API="${MARASCA_API:-https://api.github.com}"
DEST="${MARASCA_DIR:-/Applications}"

say() { printf '\033[1;31m●\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✖\033[0m %s\n' "$*" >&2; exit 1; }

# The release to install: the newest one (prereleases included, every 0.x build is one),
# or MARASCA_VERSION. Prints its JSON.
release_json() {
  if [ -n "${MARASCA_VERSION:-}" ]; then
    curl -fsSL "$API/repos/$REPO/releases/tags/v${MARASCA_VERSION#v}"
  else
    # Newest first; the first object's assets are the ones we want.
    curl -fsSL "$API/repos/$REPO/releases?per_page=1"
  fi
}

# Download URL of the first asset whose name matches $1 (a regex), from JSON on stdin.
# grep/sed rather than jq: a stock Mac has no jq.
asset_url() {
  grep -o '"browser_download_url": *"[^"]*"' |
    sed -E 's/.*"(https?:[^"]*|file:[^"]*)"$/\1/' |
    grep -E "$1" | head -n 1
}

json="$(release_json)" || die "Couldn't reach GitHub releases for $REPO."
dmg_url="$(printf '%s' "$json" | asset_url "${APP}-[0-9.]+-arm64\.dmg$" || true)"
sums_url="$(printf '%s' "$json" | asset_url 'SHA256SUMS\.txt$' || true)"
[ -n "$dmg_url" ] || die "No ${APP} DMG found in the latest release."

if [ "${1:-}" = "--print-url" ]; then
  printf '%s\n%s\n' "$dmg_url" "$sums_url"
  exit 0
fi

[ "$(uname -s)" = "Darwin" ] || die "${APP} is a macOS app."
[ "$(uname -m)" = "arm64" ] || die "${APP} needs an Apple Silicon Mac (M1 or newer)."
major="$(sw_vers -productVersion | cut -d. -f1)"
[ "$major" -ge 13 ] || die "${APP} needs macOS 13 or later (you have $(sw_vers -productVersion))."

tmp="$(mktemp -d)"
mnt="$tmp/mnt"
cleanup() {
  hdiutil detach -quiet "$mnt" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

dmg="$tmp/$(basename "$dmg_url")"
say "Downloading $(basename "$dmg_url")…"
curl -fL --progress-bar -o "$dmg" "$dmg_url"

if [ -n "$sums_url" ]; then
  curl -fsSL -o "$tmp/SHA256SUMS.txt" "$sums_url"
  expected="$(grep " $(basename "$dmg")\$" "$tmp/SHA256SUMS.txt" | cut -d' ' -f1)"
  actual="$(shasum -a 256 "$dmg" | cut -d' ' -f1)"
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || die "Checksum mismatch: the download is damaged. Nothing was installed."
  say "Checksum OK."
fi

hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$dmg"
[ -d "$mnt/${APP}.app" ] || die "The DMG has no ${APP}.app."

if pgrep -xq "$APP"; then
  say "Quitting the running ${APP}…"
  osascript -e "quit app \"$APP\"" >/dev/null 2>&1 || true
  sleep 2
fi

mkdir -p "$DEST"
target="$DEST/${APP}.app"
say "Installing to $target…"
if [ -w "$DEST" ]; then
  rm -rf "$target"
  ditto "$mnt/${APP}.app" "$target"
  xattr -dr com.apple.quarantine "$target" 2>/dev/null || true
else
  sudo rm -rf "$target"
  sudo ditto "$mnt/${APP}.app" "$target"
  sudo xattr -dr com.apple.quarantine "$target" 2>/dev/null || true
fi

if ! xcode-select -p >/dev/null 2>&1 && ! command -v git >/dev/null 2>&1; then
  say "${APP} saves through git, which isn't installed. Run: xcode-select --install"
fi

say "Installed $(basename "$dmg_url" .dmg). Opening ${APP}…"
open "$target"
