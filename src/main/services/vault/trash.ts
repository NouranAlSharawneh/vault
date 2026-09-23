import { promises as fs, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ASSETS_DIR, INBOX_SLUG, TRASH_DIR } from "@shared/constants";
import { parseDoc } from "@shared/frontmatter";
import { projectSlug, unslug } from "@shared/helpers";
import type { DocContent, SaveResult, TrashedDoc } from "@shared/types";
import { orphanedAssets } from "../assets";
import { assertInTrash, vaultPath } from "../fs/paths";
import { walkMarkdown } from "../fs/walk-markdown";
import { commitWithReadme } from "./readme";
import type { VaultContext } from "./vault.types";

/** Everything under `.trash/`, newest first. Read from disk — the index skips it. */
export async function listTrash(ctx: VaultContext): Promise<TrashedDoc[]> {
  const dir = join(ctx.root, TRASH_DIR);
  if (!existsSync(dir)) return [];
  const out: TrashedDoc[] = [];
  for (const abs of await walkMarkdown(dir)) {
    const path = vaultPath(ctx.root, abs);
    const meta = await ctx.index.readMeta(path);
    if (!meta) continue;
    const originalPath = path.slice(TRASH_DIR.length + 1);
    const [last] = await ctx.git.log(path, 1);
    // readMeta saw the `.trash/…` path, so it read the project off that folder.
    // Recover it from where the document used to live.
    const folder = originalPath.includes("/") ? originalPath.split("/")[0] : INBOX_SLUG;
    const project = meta.project === unslug(TRASH_DIR) ? "" : meta.project;
    out.push({
      meta: { ...meta, project, projectSlug: project ? projectSlug(project) : folder },
      path,
      originalPath,
      trashedAt: last?.date ?? new Date(meta.mtime).toISOString(),
    });
  }

  return out.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

export async function readTrashed(ctx: VaultContext, path: string): Promise<DocContent> {
  assertInTrash(path);
  const raw = await fs.readFile(join(ctx.root, path), "utf8");
  const meta = await ctx.index.readMeta(path);
  if (!meta) throw new Error(`Not a document: ${path}`);

  return { meta, body: parseDoc(raw).body, raw };
}

/** Move a trashed doc back where it came from (a new `-2` name if that path is taken). */
export async function restoreFromTrash(ctx: VaultContext, path: string): Promise<SaveResult> {
  assertInTrash(path);
  const target = ctx.uniquePath(path.slice(TRASH_DIR.length + 1));
  await fs.mkdir(dirname(join(ctx.root, target)), { recursive: true });
  await ctx.git.mv(path, target);
  const meta = await ctx.index.refreshFile(target);
  if (!meta) throw new Error(`Could not index ${target}`);
  await commitWithReadme(ctx, [target], `restore: ${meta.title}`);
  ctx.schedulePush();
  ctx.emit("index", ctx.index.snapshot());

  return { path: target, meta, committed: true };
}

/**
 * Delete one trashed doc — or the whole `.trash/` folder — for good, in one commit,
 * taking the images that only it was using with it. Trashing deliberately leaves those
 * behind so a restore can find them; this is the last moment anything can.
 */
export async function purgeTrash(
  ctx: VaultContext,
  path?: string,
): Promise<{ removed: number; assets: string[] }> {
  if (path) {
    assertInTrash(path);
    const meta = await ctx.index.readMeta(path);
    if (!meta) return { removed: 0, assets: [] };
    const assets = await orphanedAssets(ctx.root, [path]);
    await removeAll(ctx, [path, ...assets]);
    await ctx.git.commitPaths([], `purge: ${meta.title}`);
    ctx.schedulePush();

    return { removed: 1, assets };
  }
  const trashed = await listTrash(ctx);
  const removed = trashed.length;
  if (!existsSync(join(ctx.root, TRASH_DIR))) return { removed: 0, assets: [] };
  const assets = await orphanedAssets(
    ctx.root,
    trashed.map((t) => t.path),
  );
  await removeAll(ctx, [TRASH_DIR, ...assets]);
  await ctx.git.commitPaths([], `purge: trash (${removed} ${removed === 1 ? "doc" : "docs"})`);
  ctx.schedulePush();

  return { removed, assets };
}

/** Drop paths from git and from disk, then any `assets/` folder left with nothing in it. */
async function removeAll(ctx: VaultContext, paths: string[]): Promise<void> {
  for (const p of paths) {
    await ctx.git.removeTree(p);
    await fs.rm(join(ctx.root, p), { recursive: true, force: true });
  }
  for (const dir of new Set(paths.map(dirname).filter((d) => basename(d) === ASSETS_DIR))) {
    await fs.rmdir(join(ctx.root, dir)).catch(() => undefined);
  }
}
