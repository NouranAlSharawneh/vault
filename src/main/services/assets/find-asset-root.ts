import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";
import {
  ASSET_HOME_ROOTS,
  ASSET_MIME,
  ASSET_PROBE_LIMIT,
  ASSET_WALK_BUDGET_MS,
  ASSET_WALK_DEPTH,
  ASSET_WALK_MAX_DIRS,
  ASSET_WALK_SKIP,
} from "@shared/constants";
import { spotlightRoots } from "./spotlight";

/**
 * The folder a body's relative refs belong to, worked out without asking.
 *
 * The trick is that a ref carries its own folder with it: `docs/hero-flyin.gif` is specific
 * enough that a directory holding that *whole* path is almost certainly the project it came
 * from, where `hero-flyin.gif` alone would match every stray copy on the disk. So every
 * candidate here is verified by the full relative path, and scored by how many of the refs it
 * satisfies — a folder holding all three beats one holding a single stray match.
 *
 * Spotlight goes first, because it already knows where every file is and answers in tens of
 * milliseconds. The walk is the fallback for when the index is off, still building, or
 * excludes the folder; it stays shallow and time-boxed because the capture sheet is waiting.
 */
export async function findAssetRoot(refs: string[], known: string[] = []): Promise<string | null> {
  const probes = pickProbes(refs);
  if (!probes.length) return null;

  return (
    (await best(await spotlightRoots(probes), refs)) ?? best(await walkRoots(probes, known), refs)
  );
}

/**
 * Refs worth searching with: relative, a type we can serve, deepest first — a ref with a
 * folder in front of it identifies a project, a bare filename barely narrows anything.
 */
function pickProbes(refs: string[]): string[] {
  return refs
    .filter((r) => !isAbsolute(r) && !r.startsWith("..") && r.includes("."))
    .filter((r) => (r.split(".").pop()?.toLowerCase() ?? "") in ASSET_MIME)
    .sort((a, b) => b.split("/").length - a.split("/").length)
    .slice(0, ASSET_PROBE_LIMIT);
}

/**
 * Breadth-first over folders we already have a reason to know about — the ones remembered for
 * other projects, their parents, and the usual places code lives — collecting any that could
 * hold a probe, and giving up at the depth, count and time caps.
 */
async function walkRoots(probes: string[], known: string[]): Promise<string[]> {
  const deadline = Date.now() + ASSET_WALK_BUDGET_MS;
  const home = homedir();
  const seen = new Set<string>();
  const out: string[] = [];
  let queue = [
    ...known,
    ...known.map((k) => dirname(k)),
    ...ASSET_HOME_ROOTS.map((d) => join(home, d)),
  ].filter((d) => d && !seen.has(d) && !!seen.add(d));
  let visited = 0;

  for (let depth = 0; depth <= ASSET_WALK_DEPTH && queue.length; depth++) {
    const next: string[] = [];
    for (const dir of queue) {
      if (Date.now() > deadline || visited++ > ASSET_WALK_MAX_DIRS) return out;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue; // unreadable or gone — not worth reporting
      }
      const names = new Set(entries.map((e) => e.name));
      if (probes.some((p) => names.has(p.split("/")[0]))) out.push(dir);
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith(".") || ASSET_WALK_SKIP.has(e.name)) continue;
        const child = join(dir, e.name);
        if (!seen.has(child)) {
          seen.add(child);
          next.push(child);
        }
      }
    }
    queue = next;
  }

  return out;
}

/**
 * The candidate that actually holds the most refs. Ties go to the shallowest path: when a repo
 * and a copy nested inside it both match, the repo is the one the doc was written from.
 */
async function best(candidates: string[], refs: string[]): Promise<string | null> {
  let winner: string | null = null;
  let score = 0;
  for (const dir of new Set(candidates)) {
    let hits = 0;
    for (const ref of refs) if (await isFile(join(dir, ref))) hits++;
    const shallower = !!winner && dir.split(sep).length < winner.split(sep).length;
    if (hits > score || (hits === score && hits > 0 && shallower)) {
      winner = dir;
      score = hits;
    }
  }

  return score > 0 ? winner : null;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isFile();
  } catch {
    return false;
  }
}
