import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  GIT_LICENSE_EXIT_CODE,
  GIT_MIN_VERSION,
  GIT_PROBE_TIMEOUT_MS,
  GIT_SHELL_PROBE_TIMEOUT_MS,
} from "@shared/constants";
import { isVersionAtLeast, parseGitVersion } from "@shared/helpers";
import type { GitSource, GitStatus } from "@shared/types";
import { GIT_CANDIDATES } from "../../data/git-candidates.data";
import { runFile } from "../../lib/run-file";
import type { RunFileError } from "../../lib/run-file.types";
import type { DetectGitOptions } from "./detect-git.types";

const APPLE_GIT = "/usr/bin/git";

/**
 * Find a git Marasca can run, or say exactly why there isn't one.
 *
 * On a Mac without Apple's Command Line Tools, `/usr/bin/git` is a stub: running it — even
 * `git --version` — pops the system "requires the command line developer tools" dialog.
 * So it is only ever run once `xcode-select -p` names a developer folder that really has
 * git in it. Everything else is found by path, because an app opened from Finder doesn't
 * get the shell's PATH and would miss Homebrew's git.
 */
export async function detectGit(options: DetectGitOptions = {}): Promise<GitStatus> {
  const {
    customPath = null,
    platform = process.platform,
    home = homedir(),
    shell = process.env.SHELL || "/bin/zsh",
  } = options;

  if (customPath) return detectCustom(customPath);
  if (platform !== "darwin") return (await probe("git", "path")) ?? { state: "missing" };

  // A git that runs but can't be used (licence, too old) is remembered, not returned:
  // a working Homebrew git further down still wins over it.
  let problem: GitStatus | null = null;
  const consider = (found: GitStatus | null): GitStatus | null => {
    if (found?.state === "ready") return found;
    problem ??= found;

    return null;
  };

  const developerDir = await xcodeDeveloperDir();
  if (developerDir && existsSync(join(developerDir, "usr/bin/git"))) {
    const apple = consider(await probe(APPLE_GIT, "apple"));
    if (apple) return apple;
  }

  for (const candidate of GIT_CANDIDATES) {
    const path = candidate.path.replace(/^~(?=\/)/, home);
    if (!existsSync(path)) continue;
    const found = consider(await probe(path, candidate.source));
    if (found) return found;
  }

  const fromShell = await loginShellGit(shell);
  if (fromShell) {
    const found = consider(await probe(fromShell, "shell"));
    if (found) return found;
  }

  return problem ?? (developerDir ? { state: "broken", developerDir } : { state: "missing" });
}

async function detectCustom(binary: string): Promise<GitStatus> {
  if (!existsSync(binary))
    return { state: "custom-invalid", binary, reason: "There's no file at that path any more." };

  return (
    (await probe(binary, "custom")) ?? {
      state: "custom-invalid",
      binary,
      reason: "That file didn't answer like git does.",
    }
  );
}

/**
 * Run `<binary> --version`. Null when it didn't run or didn't answer like git; a status
 * when it did, including the two ways a real git can still be unusable.
 */
async function probe(binary: string, source: GitSource): Promise<GitStatus | null> {
  try {
    const version = parseGitVersion(await runFile(binary, ["--version"], GIT_PROBE_TIMEOUT_MS));
    if (!version) return null;

    return isVersionAtLeast(version, GIT_MIN_VERSION)
      ? { state: "ready", version, binary, source }
      : { state: "too-old", version, binary, source };
  } catch (e) {
    const failure = e as RunFileError;
    if (failure.code === GIT_LICENSE_EXIT_CODE || /xcode license/i.test(failure.stderr ?? ""))
      return { state: "license", binary };

    return null;
  }
}

/** The selected developer folder, or null when there are no developer tools at all. */
async function xcodeDeveloperDir(): Promise<string | null> {
  try {
    return (await runFile("xcode-select", ["-p"], GIT_PROBE_TIMEOUT_MS)).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Where the user's own shell finds git — for installs in places nobody could guess.
 * `command -v` only looks the name up; it never runs git, so it can't trigger the stub.
 * Apple's path is skipped here: it was already judged above, and running it is the risk.
 */
async function loginShellGit(shell: string): Promise<string | null> {
  try {
    const out = await runFile(shell, ["-lc", "command -v git"], GIT_SHELL_PROBE_TIMEOUT_MS);
    const path = out
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("/"))
      .pop();

    return path && path !== APPLE_GIT && existsSync(path) ? path : null;
  } catch {
    return null;
  }
}
