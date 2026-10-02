import { errorMessage } from "@/helpers";
import { useToast } from "@/stores/toast";
import { api } from "./api";

const carriesFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
const isMarkdown = (name: string) => /\.(md|markdown)$/i.test(name);

/**
 * Files dropped on a window, and the network coming back.
 *
 * A dropped file is never allowed to navigate the window (Chromium's default, which
 * replaced the app with the file). A markdown file opens in an editor — the one it is if
 * it lives in the vault, a new document with its text if not; anything else is turned
 * down in words. A drop something inside already took (the editor's text taking a
 * file's contents) is left to it.
 *
 * `online` is the browser's word that the network is back: main retries what was waiting
 * instead of sitting out the rest of a back-off.
 */
export function installWindowEvents(target: Window = window): () => void {
  const onDragOver = (e: DragEvent) => {
    if (!carriesFiles(e) || e.defaultPrevented) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  };
  const onDrop = (e: DragEvent) => {
    if (!carriesFiles(e)) return;
    const taken = e.defaultPrevented;
    e.preventDefault();
    if (taken) return;
    const files = [...(e.dataTransfer?.files ?? [])];
    const notes = files.filter((f) => isMarkdown(f.name));
    if (!notes.length) {
      useToast.getState().show("Marasca opens markdown files (.md) — drop one of those");

      return;
    }
    for (const f of notes)
      api("file:open", window.marasca.pathForFile(f)).catch((err: unknown) =>
        useToast.getState().show(`Couldn’t open ${f.name}: ${errorMessage(err)}`),
      );
  };
  const onOnline = () => {
    api("sync:nudge").catch(() => undefined);
  };
  target.addEventListener("dragover", onDragOver);
  target.addEventListener("drop", onDrop);
  target.addEventListener("online", onOnline);

  return () => {
    target.removeEventListener("dragover", onDragOver);
    target.removeEventListener("drop", onDrop);
    target.removeEventListener("online", onOnline);
  };
}
