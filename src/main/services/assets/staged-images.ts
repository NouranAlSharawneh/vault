import { randomBytes } from "node:crypto";
import { promises as fs, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { ASSET_MAX_BYTES, PASTED_IMAGE_EXTENSIONS, PASTED_MAX_AGE_MS } from "@shared/constants";
import { isPastedRef } from "@shared/helpers";

/**
 * Images pasted or dropped into the editor wait here, in app data, until their document
 * is saved. They are named `paste-<id>.<ext>` and found again by that name alone, so the
 * link works wherever the document ends up: a save copies the file into the document's
 * own `assets/` — whatever its project is by then — and rewrites the link. Nothing is
 * written into the vault before a save, so a discarded document leaves nothing behind.
 */
let dir: string | null = null;

/** Where the waiting images live; set once at startup (and by tests). */
export function setStagingDir(path: string | null): void {
  dir = path;
}

/** The waiting file a `paste-<id>.<ext>` link points at, if there is one. */
export function stagedImagePath(ref: string): string | null {
  if (!dir || !isPastedRef(ref)) return null;
  const path = join(dir, ref);

  return existsSync(path) ? path : null;
}

/**
 * Keep an image's bytes for later and say what to link it as. Only the image types a
 * reader shows, and nothing over GitHub's limit: such a file would block every push.
 */
export async function stageImage(name: string, bytes: Uint8Array): Promise<string> {
  if (!dir) throw new Error("There’s nowhere to keep pasted images yet.");
  const ext = extname(name).slice(1).toLowerCase().replace("jpeg", "jpg");
  if (!(PASTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext))
    throw new Error("Only PNG, JPEG, GIF and WebP images can be pasted in.");
  if (bytes.byteLength > ASSET_MAX_BYTES)
    throw new Error("That image is over GitHub’s 100 MB limit, so it can’t go in the vault.");
  await fs.mkdir(dir, { recursive: true });
  const ref = `paste-${randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(join(dir, ref), bytes);

  return ref;
}

/** Clear out images nobody saved, older than `maxAgeMs`. Best effort. */
export async function pruneStaged(maxAgeMs = PASTED_MAX_AGE_MS, now = Date.now()): Promise<void> {
  const home = dir;
  if (!home || !existsSync(home)) return;
  const names = await fs.readdir(home).catch(() => [] as string[]);
  await Promise.all(
    names.filter(isPastedRef).map(async (n) => {
      const path = join(home, n);
      if (now - statSync(path).mtimeMs > maxAgeMs) await fs.rm(path, { force: true });
    }),
  );
}
