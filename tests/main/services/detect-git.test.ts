import type * as Fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectGit } from "@main/services/git/detect-git";

const runFile = vi.hoisted(() => vi.fn());
const existing = vi.hoisted(() => new Set<string>());

vi.mock("@main/lib/run-file", () => ({ runFile }));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof Fs>()),
  existsSync: (p: string) => existing.has(p),
}));

type Answer = string | { code?: number | string; stderr?: string };

/** Answer each command line from a table; anything unlisted fails the way a missing file does. */
function commands(table: Record<string, Answer>) {
  runFile.mockImplementation(async (file: string, args: string[]) => {
    const answer = table[[file, ...args].join(" ")];
    if (answer === undefined)
      throw Object.assign(new Error(`spawn ${file} ENOENT`), { code: "ENOENT", stderr: "" });
    if (typeof answer === "string") return answer;
    throw Object.assign(new Error("failed"), { stderr: "", ...answer });
  });
}

const ranAppleGit = () => runFile.mock.calls.some((call: unknown[]) => call[0] === "/usr/bin/git");

const mac = { platform: "darwin" as const, home: "/Users/nunu", shell: "/bin/zsh" };
const CLT = "/Library/Developer/CommandLineTools";

beforeEach(() => {
  runFile.mockReset();
  existing.clear();
});

describe("detectGit on macOS", () => {
  it("uses Apple's git when the developer folder really has it", async () => {
    existing.add(`${CLT}/usr/bin/git`);
    commands({
      "xcode-select -p": `${CLT}\n`,
      "/usr/bin/git --version": "git version 2.39.5 (Apple Git-154)\n",
    });
    expect(await detectGit(mac)).toEqual({
      state: "ready",
      version: "2.39.5",
      binary: "/usr/bin/git",
      source: "apple",
    });
  });

  it("never runs /usr/bin/git when there are no developer tools — it would pop Apple's dialog", async () => {
    commands({});
    expect(await detectGit(mac)).toEqual({ state: "missing" });
    expect(ranAppleGit()).toBe(false);
  });

  it("finds Homebrew's git, which a Finder-launched app's PATH leaves out", async () => {
    existing.add("/opt/homebrew/bin/git");
    commands({ "/opt/homebrew/bin/git --version": "git version 2.51.0\n" });
    expect(await detectGit(mac)).toMatchObject({
      state: "ready",
      binary: "/opt/homebrew/bin/git",
      source: "homebrew",
    });
    expect(ranAppleGit()).toBe(false);
  });

  it("expands ~ for per-user installs", async () => {
    existing.add("/Users/nunu/.nix-profile/bin/git");
    commands({ "/Users/nunu/.nix-profile/bin/git --version": "git version 2.50.1\n" });
    expect(await detectGit(mac)).toMatchObject({ state: "ready", source: "nix" });
  });

  it("asks the login shell last, and ignores it pointing back at Apple's stub", async () => {
    existing.add("/Users/nunu/bin/git");
    existing.add("/usr/bin/git");
    commands({
      "/bin/zsh -lc command -v git": "welcome back!\n/Users/nunu/bin/git\n",
      "/Users/nunu/bin/git --version": "git version 2.45.0\n",
    });
    expect(await detectGit(mac)).toMatchObject({ binary: "/Users/nunu/bin/git", source: "shell" });

    commands({ "/bin/zsh -lc command -v git": "/usr/bin/git\n" });
    expect(await detectGit(mac)).toEqual({ state: "missing" });
    expect(ranAppleGit()).toBe(false);
  });

  it("calls a developer folder with no git in it broken — what a macOS update leaves behind", async () => {
    commands({ "xcode-select -p": `${CLT}\n` });
    expect(await detectGit(mac)).toEqual({ state: "broken", developerDir: CLT });
    expect(ranAppleGit()).toBe(false);
  });

  it("recognises the Xcode licence block by its exit code or its message", async () => {
    const xcode = "/Applications/Xcode.app/Contents/Developer";
    existing.add(`${xcode}/usr/bin/git`);
    commands({ "xcode-select -p": xcode, "/usr/bin/git --version": { code: 69 } });
    expect(await detectGit(mac)).toEqual({ state: "license", binary: "/usr/bin/git" });

    commands({
      "xcode-select -p": xcode,
      "/usr/bin/git --version": {
        code: 1,
        stderr: "You have not agreed to the Xcode license agreements.",
      },
    });
    expect(await detectGit(mac)).toMatchObject({ state: "license" });
  });

  it("prefers a working Homebrew git over an Apple one that can't be used", async () => {
    existing.add(`${CLT}/usr/bin/git`);
    existing.add("/usr/local/bin/git");
    commands({
      "xcode-select -p": CLT,
      "/usr/bin/git --version": { code: 69 },
      "/usr/local/bin/git --version": "git version 2.44.0\n",
    });
    expect(await detectGit(mac)).toMatchObject({ state: "ready", binary: "/usr/local/bin/git" });
  });

  it("flags a git too old for `init -b`", async () => {
    existing.add(`${CLT}/usr/bin/git`);
    commands({
      "xcode-select -p": CLT,
      "/usr/bin/git --version": "git version 2.24.3 (Apple Git-128)",
    });
    expect(await detectGit(mac)).toMatchObject({ state: "too-old", version: "2.24.3" });
  });
});

describe("detectGit with a git chosen in Settings", () => {
  it("uses it and nothing else", async () => {
    existing.add("/tools/git");
    commands({ "/tools/git --version": "git version 2.46.0" });
    expect(await detectGit({ ...mac, customPath: "/tools/git" })).toMatchObject({
      state: "ready",
      source: "custom",
    });
    expect(runFile).toHaveBeenCalledTimes(1);
  });

  it("says when the file is gone, or isn't git", async () => {
    commands({});
    expect(await detectGit({ ...mac, customPath: "/tools/git" })).toMatchObject({
      state: "custom-invalid",
      reason: "There's no file at that path any more.",
    });
    existing.add("/tools/not-git");
    commands({ "/tools/not-git --version": "hello" });
    expect(await detectGit({ ...mac, customPath: "/tools/not-git" })).toMatchObject({
      state: "custom-invalid",
      reason: "That file didn't answer like git does.",
    });
  });
});

describe("detectGit elsewhere", () => {
  it("runs git from PATH off macOS, where there is no stub to avoid", async () => {
    commands({ "git --version": "git version 2.34.1" });
    expect(await detectGit({ platform: "linux" })).toMatchObject({
      state: "ready",
      binary: "git",
      source: "path",
    });
    commands({});
    expect(await detectGit({ platform: "linux" })).toEqual({ state: "missing" });
  });
});
