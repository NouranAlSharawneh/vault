import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs build script, no types
import { releaseNotes } from "../../scripts/release-notes.mjs";
// @ts-expect-error — plain .mjs build script, no types
import { nextVersion } from "../../scripts/release.mjs";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const pkg = JSON.parse(read("package.json")) as {
  version: string;
  build: { artifactName?: string };
  scripts: Record<string, string>;
};

describe("nextVersion", () => {
  it.each([
    ["0.0.1", "patch", "0.0.2"],
    ["0.0.9", "minor", "0.1.0"],
    ["0.4.2", "major", "1.0.0"],
    ["0.0.1", "current", "0.0.1"],
    ["0.0.1", "0.2.0", "0.2.0"],
  ])("%s + %s → %s", (current, bump, next) => {
    expect(nextVersion(current, bump)).toBe(next);
  });

  it("refuses bumps and versions it can't read", () => {
    expect(() => nextVersion("0.0.1", "huge")).toThrow(/Unknown bump/);
    expect(() => nextVersion("0.1", "patch")).toThrow(/not x\.y\.z/);
  });
});

describe("releaseNotes", () => {
  const log = `# Changelog\n\nintro\n\n## [0.0.2] - 2026-10-01\n\n- Two\n\n## [0.0.1] - 2026-09-24\n\n- One\n`;

  it("returns just that version's section, with or without the v", () => {
    expect(releaseNotes(log, "0.0.2")).toBe("- Two");
    expect(releaseNotes(log, "v0.0.1")).toBe("- One");
  });

  it("is null for a version with no section, so the release fails instead of going out bare", () => {
    expect(releaseNotes(log, "0.0.3")).toBeNull();
    // 0.0.1 must not match 0.0.10.
    expect(releaseNotes("## [0.0.10] - x\n\n- Ten\n", "0.0.1")).toBeNull();
  });
});

describe("release setup", () => {
  it("the current version is x.y.z and has CHANGELOG notes", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(releaseNotes(read("CHANGELOG.md"), pkg.version)).toBeTruthy();
  });

  it("package-lock agrees with package.json", () => {
    const lock = JSON.parse(read("package-lock.json")) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""].version).toBe(pkg.version);
  });

  it("DMGs are named <product>-<version>-<arch>, as the install guide says", () => {
    expect(pkg.build.artifactName).toBe("${productName}-${version}-${arch}.${ext}");
  });

  it("the release workflow builds on a tag, checks the version, never auto-publishes", () => {
    const wf = read(".github/workflows/release.yml");
    expect(wf).toMatch(/tags:\s*\["v\*\.\*\.\*"\]/);
    expect(wf).toMatch(/runs-on: macos-/);
    expect(wf).toContain("does not match package.json version");
    expect(wf).toContain("scripts/release-notes.mjs");
    expect(wf).toContain("--publish never");
    expect(wf).toContain("--draft");
    expect(wf).toContain("npm run verify:sign");
    // The client ID is a variable, and no secret is ever passed to the build.
    expect(wf).not.toMatch(/CLIENT_SECRET/);
  });

  it("CI checks every pull request", () => {
    expect(existsSync(join(root, ".github/workflows/ci.yml"))).toBe(true);
    expect(read(".github/workflows/ci.yml")).toMatch(/pull_request/);
  });

  it("exposes the release scripts", () => {
    expect(pkg.scripts.release).toBe("node scripts/release.mjs");
  });
});
