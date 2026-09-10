import { clipboard } from "electron";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClipboardCapture } from "@shared/types";
import { analyseClipboard } from "./analyse-clipboard";

/**
 * Read the system clipboard and analyse it. A markdown *file* copied in Finder wins over
 * text: its contents become the capture and its folder is where relative images resolve.
 */
export async function readClipboard(): Promise<ClipboardCapture> {
  const file = await readClipboardFile();
  if (file) return { ...analyseClipboard(file.text), sourcePath: file.path };
  let text = "";
  let html = "";
  try {
    text = (await clipboard.readText()) ?? "";
    for (const item of await clipboard.read()) {
      if (item.types.includes("text/html")) {
        html = await ((await item.getType("text/html")) as Blob).text();
        break;
      }
    }
  } catch {
    /* clipboard empty or non-text */
  }
  return analyseClipboard(text, html);
}

/** A file copied in Finder shows up as `public.file-url` (raw) or `text/uri-list`. */
const FILE_URL_TYPES = [
  'electron application/osclipboard;format="public.file-url"',
  "text/uri-list",
];

async function readClipboardFile(): Promise<{ path: string; text: string } | null> {
  try {
    for (const item of await clipboard.read()) {
      const type = FILE_URL_TYPES.find((t) => item.types.includes(t));
      if (!type) continue;
      const url = (await ((await item.getType(type)) as Blob).text()).split(/\r?\n/)[0].trim();
      if (!url.startsWith("file:")) return null;
      const path = fileURLToPath(url);
      if (!/\.(md|markdown|txt)$/i.test(path)) return null;
      return { path, text: await fs.readFile(path, "utf8") };
    }
  } catch {
    /* not a file, or unreadable */
  }
  return null;
}
