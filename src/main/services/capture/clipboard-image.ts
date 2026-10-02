import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { app, clipboard, nativeImage } from "electron";
import { countWords } from "@shared/helpers";
import type { ClipboardCapture } from "@shared/types";

/** The image flavours a screenshot or a copied picture arrives in, and their extensions. */
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

/** Where the clipboard's image waits until a save copies it into the vault. */
export function clipboardImageDir(): string {
  return join(app.getPath("temp"), "marasca-clipboard");
}

function day(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * The image's file name: the day it was captured, and a few characters of its content,
 * so the same screenshot shown twice is the same clip — and a second one that day is not.
 */
export function clipboardImageName(bytes: Buffer, ext: string, at: Date): string {
  const id = createHash("sha1").update(bytes).digest("hex").slice(0, 6);

  return `clipboard-${day(at)}-${id}.${ext}`;
}

/**
 * A capture of an image: a one-line document linking it, with the image's folder as where
 * its link resolves. Saving it goes through the same image import as any other capture,
 * which copies it into `<project>/assets/` — or leaves it out, and says so, when it is
 * over GitHub's size limit.
 */
export function imageCapture(
  name: string,
  dir: string,
  image: NonNullable<ClipboardCapture["image"]>,
  at: Date,
): ClipboardCapture {
  const title = `Clipboard image ${day(at)}`;
  const text = `![${title}](${name})\n`;

  return {
    text,
    words: countWords(text),
    lines: 1,
    looksLikeMarkdown: true,
    detectedSource: "manual",
    detectedTitle: title,
    assetDir: dir,
    image,
  };
}

/** The clipboard's image, written out and offered as a capture; null when there is none. */
export async function readClipboardImage(
  dir = clipboardImageDir(),
  at = new Date(),
): Promise<ClipboardCapture | null> {
  for (const item of await clipboard.read()) {
    const type = Object.keys(IMAGE_TYPES).find((t) => item.types.includes(t));
    if (!type) continue;
    const bytes = Buffer.from(await ((await item.getType(type)) as Blob).arrayBuffer());
    if (!bytes.length) return null;
    const { width, height } = nativeImage.createFromBuffer(bytes).getSize();
    const name = clipboardImageName(bytes, IMAGE_TYPES[type], at);
    // One image at a time: the last one's copy goes, so the folder never grows.
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, name), bytes);

    return imageCapture(name, dir, { width, height, bytes: bytes.length }, at);
  }

  return null;
}
