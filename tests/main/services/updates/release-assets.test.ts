import { describe, expect, it } from "vitest";
import type { RawRelease } from "@main/network/github/github.types";
import { expectedHash, pickUpdateAssets } from "@main/services/updates/release-assets";

const REPO = "NouranAlSharawneh/vault";
const download = (name: string, version = "0.0.5", repo = REPO) => ({
  name,
  browser_download_url: `https://github.com/${repo}/releases/download/v${version}/${name}`,
  size: 1,
});
const release = (assets: RawRelease["assets"]): RawRelease => ({
  tag_name: "v0.0.5",
  html_url: "https://github.com/x",
  draft: false,
  prerelease: true,
  assets,
});

describe("pickUpdateAssets", () => {
  it("takes this Mac's DMG of exactly that version, and the checksums", () => {
    const r = release([
      download("Marasca-0.0.5-x64.dmg"),
      download("Marasca-0.0.5-arm64.dmg.blockmap"),
      download("Marasca-0.0.5-arm64.dmg"),
      download("SHA256SUMS.txt"),
    ]);
    const { dmg, sums } = pickUpdateAssets(r, REPO, "0.0.5", "arm64");
    expect(dmg.name).toBe("Marasca-0.0.5-arm64.dmg");
    expect(sums.name).toBe("SHA256SUMS.txt");
  });

  it("refuses a download from anywhere but that release of this repo", () => {
    // The URL decides what gets installed, so a look-alike name is not enough.
    for (const dmg of [
      download("Marasca-0.0.5-arm64.dmg", "0.0.5", "someone/else"),
      download("Marasca-0.0.5-arm64.dmg", "0.0.4"),
      {
        ...download("Marasca-0.0.5-arm64.dmg"),
        browser_download_url: "https://evil.example/Marasca-0.0.5-arm64.dmg",
      },
    ])
      expect(() =>
        pickUpdateAssets(release([dmg, download("SHA256SUMS.txt")]), REPO, "0.0.5", "arm64"),
      ).toThrow(/no Marasca download for this Mac/);
  });

  it("won't install what it can't verify", () => {
    expect(() =>
      pickUpdateAssets(release([download("Marasca-0.0.5-arm64.dmg")]), REPO, "0.0.5", "arm64"),
    ).toThrow(/no checksums/);
  });
});

describe("expectedHash", () => {
  const a = "a".repeat(64);
  const b = "B".repeat(64);

  it("reads shasum's lines, text or binary mode", () => {
    const sums = `${a}  Marasca-0.0.5-arm64.dmg\n${b} *Other.dmg\n`;
    expect(expectedHash(sums, "Marasca-0.0.5-arm64.dmg")).toBe(a);
    expect(expectedHash(sums, "Other.dmg")).toBe("b".repeat(64));
  });

  it("is null for a name it doesn't list, or a line that isn't a hash", () => {
    expect(expectedHash(`${a}  Marasca-0.0.4-arm64.dmg`, "Marasca-0.0.5-arm64.dmg")).toBeNull();
    expect(expectedHash("abc  Marasca-0.0.5-arm64.dmg", "Marasca-0.0.5-arm64.dmg")).toBeNull();
  });
});
