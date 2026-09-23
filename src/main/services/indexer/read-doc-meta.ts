import { promises as fs, type Stats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { HEAD_BYTES, INBOX_SLUG, SMALL_FILE_BYTES } from "@shared/constants";
import { excerptOf, parseDoc, type ParsedDoc } from "@shared/frontmatter";
import { countWords, projectSlug, unslug } from "@shared/helpers";
import type { DocMeta } from "@shared/types";

/**
 * Everything the app knows about one markdown file, read from disk alone. Kept out of
 * the indexer because it holds no state: `.trash/` listings call it for paths the
 * scanner deliberately never visits.
 */
export async function readDocMeta(root: string, relPath: string): Promise<DocMeta | null> {
  const abs = join(root, relPath);
  let st: Stats;
  try {
    st = await fs.stat(abs);
  } catch {
    return null;
  }
  const small = st.size <= SMALL_FILE_BYTES;
  const { frontmatter, body } = small
    ? parseDoc(await fs.readFile(abs, "utf8"))
    : await parseEnds(abs, st.size);
  const segments = relPath.split("/");
  const folderSlug = segments.length > 1 ? segments[0] : INBOX_SLUG;
  const base = {
    path: relPath,
    excerpt: excerptOf(body),
    mtime: st.mtimeMs,
    size: st.size,
    words: small ? countWords(body) : Math.round(st.size / 6),
  };
  if (!frontmatter) {
    return {
      ...base,
      title: titleFromPath(relPath, body),
      project: "",
      projectSlug: folderSlug,
      tags: [],
      created: new Date(st.birthtimeMs || st.mtimeMs).toISOString(),
      source: "other",
      orphan: true,
    };
  }
  const slug = projectSlug(frontmatter.project);
  const meta: DocMeta = {
    ...frontmatter,
    ...base,
    projectSlug: slug === INBOX_SLUG ? folderSlug : slug,
    orphan: false,
  };
  if (!meta.project && folderSlug !== INBOX_SLUG) meta.project = unslug(folderSlug);

  return meta;
}

/**
 * Big file: read the head (excerpt, or a classic top block) and the tail (Vault's
 * trailing metadata block) without touching the middle.
 */
async function parseEnds(abs: string, size: number): Promise<ParsedDoc> {
  const fh = await fs.open(abs, "r");
  try {
    const head = await readChunk(fh, 0, SMALL_FILE_BYTES);
    const fromHead = parseDoc(head);
    if (fromHead.frontmatter) return fromHead;
    const tail = await readChunk(fh, Math.max(0, size - HEAD_BYTES), HEAD_BYTES);
    const fromTail = parseDoc(tail);

    return { ...fromTail, body: head };
  } finally {
    await fh.close();
  }
}

async function readChunk(fh: FileHandle, offset: number, bytes: number): Promise<string> {
  const buf = Buffer.alloc(bytes);
  const { bytesRead } = await fh.read(buf, 0, bytes, offset);

  return buf.subarray(0, bytesRead).toString("utf8");
}

function titleFromPath(relPath: string, body: string): string {
  const h = /^\s{0,3}#\s+(.+)$/m.exec(body);
  if (h) return h[1].trim();

  return unslug(relPath.split("/").pop()!.replace(/\.md$/, ""));
}
