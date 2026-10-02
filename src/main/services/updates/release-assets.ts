import type { RawRelease, RawReleaseAsset } from "../../network/github/github.types";

/** The two files an update needs from a release. */
export interface UpdateAssets {
  dmg: RawReleaseAsset;
  sums: RawReleaseAsset;
}

/**
 * The DMG for this Mac and the checksums beside it, from the release of `version` in
 * `repo`. Both must be there, and both must be downloads of that very release: the URL is
 * the one thing in the answer that decides what gets installed, so nothing else is taken.
 */
export function pickUpdateAssets(
  release: RawRelease,
  repo: string,
  version: string,
  arch: string,
): UpdateAssets {
  const prefix = `https://github.com/${repo}/releases/download/v${version}/`;
  const find = (name: string) =>
    release.assets.find((a) => a.name === name && a.browser_download_url === prefix + name);
  const dmg = find(`Marasca-${version}-${arch}.dmg`);
  const sums = find("SHA256SUMS.txt");
  if (!dmg) throw new Error(`Release ${version} has no Marasca download for this Mac.`);
  if (!sums) throw new Error(`Release ${version} has no checksums to verify the download.`);

  return { dmg, sums };
}

/**
 * The SHA-256 that `SHA256SUMS.txt` lists for `name`, lowercased, or null. Lines are
 * `shasum -a 256` output: the hash, then the name, with a `*` before it in binary mode.
 */
export function expectedHash(sums: string, name: string): string | null {
  for (const line of sums.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line.trim());
    if (m && m[2] === name) return m[1].toLowerCase();
  }

  return null;
}
