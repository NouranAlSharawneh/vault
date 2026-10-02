import { execFile } from "node:child_process";
import { basename, sep } from "node:path";
import { promisify } from "node:util";
import { SPOTLIGHT_BUDGET_MS } from "@shared/constants";

const run = promisify(execFile);

/**
 * Folders that might be what a relative ref is relative to, according to Spotlight.
 *
 * `mdfind` searches by filename only, so `hero-flyin.gif` comes back with every copy on the
 * disk; the ref's own folder is what narrows it down, which is why only hits ending in the
 * whole `docs/hero-flyin.gif` survive. Nothing here is trusted on its own — the caller still
 * checks the returned folder actually holds the files.
 */
export async function spotlightRoots(probes: string[]): Promise<string[]> {
  // All at once, and one failure costs only its own answer: a common name like `logo.png`
  // overflowed the buffer, and that used to end the search for every probe after it.
  const answers = await Promise.allSettled(
    probes.map((probe) =>
      run("mdfind", ["-name", basename(probe)], {
        timeout: SPOTLIGHT_BUDGET_MS,
        maxBuffer: 8 << 20,
      }).then(({ stdout }) => rootsFromHits(stdout, probe)),
    ),
  );

  return answers.flatMap((a) => (a.status === "fulfilled" ? a.value : []));
}

/** `/Users/n/concorde/docs/hero.gif` + `docs/hero.gif` → `/Users/n/concorde`. */
export function rootsFromHits(stdout: string, probe: string): string[] {
  const tail = sep + probe.split("/").join(sep);

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((hit) => hit.endsWith(tail))
    .map((hit) => hit.slice(0, -tail.length));
}
