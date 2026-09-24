import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Release guard. Everything under src/ ends up inside the .app, and anything in there can
 * be unpacked and read. An OAuth client secret must never be read, bundled or sent: the
 * app signs in with the device flow or a pasted token, neither of which needs one.
 */
const SRC = join(process.cwd(), "src");
const FORBIDDEN = [/CLIENT_SECRET/, /client_secret/, /clientSecret/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    return statSync(path).isDirectory()
      ? files(path)
      : /\.(ts|tsx|js|mjs)$/.test(name)
        ? [path]
        : [];
  });
}

describe("no OAuth client secret in the shipped source", () => {
  it.each(files(SRC).map((f) => [relative(SRC, f), f]))("%s", (_name, path) => {
    const text = readFileSync(path, "utf8");
    for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
  });

  it("the browser-redirect (web) flow is gone from the IPC surface", async () => {
    const { INVOKE_CHANNELS, EVENT_CHANNELS } = await import("@shared/ipc/channels");
    const all: string[] = [...INVOKE_CHANNELS, ...EVENT_CHANNELS];
    expect(all.filter((c) => c.startsWith("auth:web"))).toEqual([]);
  });
});
