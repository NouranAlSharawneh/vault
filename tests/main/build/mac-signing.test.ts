import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Release guard for the macOS build config. An unsigned (`identity: null`) arm64 app is
 * reported by Gatekeeper as "damaged" with only a Move to Trash button. Ad-hoc signing is
 * free and turns that into the recoverable "could not verify" prompt (docs/INSTALL.md).
 */
interface MacBuild {
  identity?: string | null;
  hardenedRuntime?: boolean;
  icon?: string;
  target?: string[];
}

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  build: { mac: MacBuild };
  scripts: Record<string, string>;
};
const mac = pkg.build.mac;

describe("macOS build signing", () => {
  it("is ad-hoc signed, never skipped", () => {
    expect(mac.identity).not.toBeNull();
    expect(mac.identity).toBe("-");
  });

  it("keeps hardened runtime off while ad-hoc, so Electron's frameworks still load", () => {
    // Hardened runtime + ad-hoc identity fails library validation at launch.
    if (mac.identity === "-") expect(mac.hardenedRuntime).toBe(false);
  });

  it("points at an app icon that exists", () => {
    expect(mac.icon).toBeTruthy();
    expect(existsSync(join(process.cwd(), mac.icon!))).toBe(true);
  });

  it("ships a DMG and a script to verify the signature", () => {
    expect(mac.target).toContain("dmg");
    expect(pkg.scripts["verify:sign"]).toMatch(/codesign --verify/);
  });

  it("documents the first-open step for users", () => {
    const guide = readFileSync(join(process.cwd(), "docs/INSTALL.md"), "utf8");
    expect(guide).toMatch(/Open Anyway/);
  });
});
