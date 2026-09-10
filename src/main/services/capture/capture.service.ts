import { clipboard } from "electron";
import type { ClipboardCapture } from "@shared/types";
import { analyseClipboard } from "./analyse-clipboard";

/** Read the system clipboard (text + HTML flavour) and analyse it. */
export async function readClipboard(): Promise<ClipboardCapture> {
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
