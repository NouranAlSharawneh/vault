import { promises as fs } from "node:fs";
import { join } from "node:path";
import { INBOX_SLUG, README_FILE } from "@shared/constants";
import { composeDoc, parseDoc } from "@shared/frontmatter";
import { projectSlug } from "@shared/helpers";
import { freeName } from "../fs/paths";
import type { VaultContext } from "./vault.types";

/** Every project that has at least one document, alphabetically. */
export function projects(ctx: VaultContext): string[] {
  return [
    ...new Set(
      ctx.index
        .all()
        .map((d) => d.project)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

/** PRD D2: one atomic commit that moves the folder and rewrites `project:`. */
export async function renameProject(
  ctx: VaultContext,
  from: string,
  to: string,
): Promise<{ moved: number }> {
  const fromSlug = projectSlug(from);
  const toSlug = projectSlug(to);
  if (fromSlug === INBOX_SLUG) throw new Error("Inbox cannot be renamed");
  const docs = ctx.index.all().filter((d) => d.projectSlug === fromSlug);
  if (!docs.length) return { moved: 0 };
  await fs.mkdir(join(ctx.root, toSlug), { recursive: true });
  const touched: string[] = [];
  for (const d of docs) {
    const dest =
      fromSlug === toSlug ? d.path : ctx.uniquePath(`${toSlug}/${d.path.split("/").pop()}`);
    const raw = await fs.readFile(join(ctx.root, d.path), "utf8");
    const { frontmatter, body, extra } = parseDoc(raw);
    const next = frontmatter ? composeDoc({ ...frontmatter, project: to }, body, extra) : raw;
    if (dest !== d.path) {
      await fs.rename(join(ctx.root, d.path), join(ctx.root, dest));
      ctx.index.remove(d.path);
    }
    await fs.writeFile(join(ctx.root, dest), next);
    touched.push(dest);
  }
  if (fromSlug !== toSlug) {
    // The documents have moved; everything else in the folder has not. `assets/` above
    // all — leaving it behind broke every relative image in the project and left the
    // old folder sitting on disk, because the rmdir here could never succeed.
    await moveRemaining(join(ctx.root, fromSlug), join(ctx.root, toSlug));
    await fs.rmdir(join(ctx.root, fromSlug)).catch(() => undefined);
  }
  for (const p of touched) await ctx.index.refreshFile(p);
  await ctx.writeReadme();
  // git detects the moves as renames on its own; one commit covers both folders.
  await ctx.git.git.add(["-A", "--", fromSlug, toSlug, README_FILE]);
  await ctx.git.git.commit(`rename project: ${from} → ${to}`);
  ctx.schedulePush();
  ctx.emit("index", ctx.index.snapshot());

  return { moved: docs.length };
}

/**
 * Move whatever a project folder still holds into its new home, merging directories
 * rather than replacing them. A name already taken on the other side keeps both files:
 * one of the two references will be wrong, but no bytes are thrown away.
 */
async function moveRemaining(fromDir: string, toDir: string): Promise<void> {
  const entries = await fs.readdir(fromDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const src = join(fromDir, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(join(toDir, entry.name), { recursive: true });
      await moveRemaining(src, join(toDir, entry.name));
      await fs.rmdir(src).catch(() => undefined);
      continue;
    }
    const dot = entry.name.lastIndexOf(".");
    const [stem, ext] =
      dot > 0 ? [entry.name.slice(0, dot), entry.name.slice(dot)] : [entry.name, ""];

    await fs.rename(src, join(toDir, freeName(toDir, stem, ext)));
  }
}
