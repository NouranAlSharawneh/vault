import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UPDATE_HELPER_SCRIPT } from "@main/services/updates/update-helper";

/**
 * The real script under /bin/sh, on folders standing in for the apps: an "app" is a folder
 * with a VERSION file, and the opener records what it was asked to open.
 */
function scene() {
  const root = mkdtempSync(join(tmpdir(), "marasca-helper-test-"));
  const app = (path: string, version: string) => {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "VERSION"), version);
  };
  const target = join(root, "Applications", "Marasca.app");
  const staging = join(root, "Applications", ".Marasca-update");
  app(target, "old");
  mkdirSync(staging, { recursive: true });
  const script = join(staging, "swap.sh");
  writeFileSync(script, UPDATE_HELPER_SCRIPT);
  const opened = join(root, "opened");
  const opener = join(root, "opener.sh");
  writeFileSync(opener, `#!/bin/sh\nprintf '%s' "$1" > "${opened}"\n`);
  chmodSync(opener, 0o755);
  const log = join(root, "update.log");
  const version = () => readFileSync(join(target, "VERSION"), "utf8");

  /** Run the swap, waiting on `pid`, and resolve with its exit code. */
  const run = (pid: number, wait = 5) =>
    new Promise<number | null>((resolve) => {
      const sh = spawn("/bin/sh", [
        script,
        String(pid),
        target,
        staging,
        log,
        String(wait),
        opener,
      ]);
      sh.on("exit", resolve);
    });

  return { app, target, staging, opened, log, version, run };
}

/** A process that stands in for Marasca, quitting after `ms`. */
function marasca(ms: number) {
  const p = spawn("sleep", [String(ms / 1000)]);

  return p.pid!;
}

describe("the update swap", () => {
  it("waits for Marasca to quit, puts the new version in its place and opens it", async () => {
    const s = scene();
    s.app(join(s.staging, "Marasca.app"), "new");
    const pid = marasca(400);
    const started = Date.now();
    expect(await s.run(pid)).toBe(0);
    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    expect(s.version()).toBe("new");
    expect(existsSync(s.staging)).toBe(false);
    expect(readFileSync(s.opened, "utf8")).toBe(s.target);
    expect(readFileSync(s.log, "utf8")).toMatch(/installed/);
  });

  it("reopens the version it has when nothing was staged", async () => {
    const s = scene();
    expect(await s.run(marasca(0))).toBe(0);
    expect(s.version()).toBe("old");
    expect(readFileSync(s.opened, "utf8")).toBe(s.target);
    expect(readFileSync(s.log, "utf8")).toMatch(/nothing staged/);
  });

  it("puts the old version back when the new one can't be moved in", async () => {
    const s = scene();
    const fresh = join(s.staging, "Marasca.app");
    s.app(fresh, "new");
    // A folder that can't be written can't be moved to another one: the second rename fails.
    chmodSync(fresh, 0o555);
    try {
      expect(await s.run(marasca(0))).toBe(0);
    } finally {
      chmodSync(fresh, 0o755);
    }
    expect(s.version()).toBe("old");
    expect(readFileSync(s.opened, "utf8")).toBe(s.target);
    expect(readFileSync(s.log, "utf8")).toMatch(/putting the old one back/);
  });

  it("changes nothing when Marasca never quits", async () => {
    const s = scene();
    s.app(join(s.staging, "Marasca.app"), "new");
    const pid = marasca(5000);
    expect(await s.run(pid, 1)).toBe(1);
    process.kill(pid);
    expect(s.version()).toBe("old");
    expect(existsSync(s.opened)).toBe(false);
    expect(existsSync(s.staging)).toBe(false);
  });
});
