import { useCallback, useRef, useState } from "react";
import { errorMessage, plural } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { DocMeta } from "@shared/types";
import type { TrashAction } from "../main.types";
import { isTrashed } from "./use-document.hook";

/**
 * Move to trash (with Undo), restore, and delete forever for the doc in the reader.
 * Each one refreshes the trash list and shows a toast; the selection follows the doc.
 *
 * One at a time. Each is a git move and a commit, and the doc stays on screen until main
 * answers — a second click in that window sent the same path again, which found the file
 * already gone (or raced the first commit) and failed into an error toast. `busy` names
 * the one in flight so its button can say so.
 */
export function useTrashActions(
  doc: DocMeta | null,
  select: (path: string | null) => void,
  /**
   * Where the selection goes once the document leaves the list: the next one down. It
   * used to go nowhere — a blank reader after every ⌘⌫, and focus dropped on the page.
   */
  neighbour: (path: string) => string | null = () => null,
) {
  const show = useToast((s) => s.show);
  const refreshTrash = useApp((s) => s.refreshTrash);
  const [busy, setBusy] = useState<TrashAction | null>(null);
  // The guard is a ref, not `busy`: ⌘⌫ and the palette call in without a click, and can
  // arrive before the render that would have disabled the button.
  const inFlight = useRef(false);

  const once = useCallback(
    async (action: TrashAction, work: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(action);
      try {
        await work();
      } catch (e) {
        show(errorMessage(e));
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    },
    [show],
  );

  const trash = useCallback(async () => {
    if (!doc || isTrashed(doc.path)) return;
    await once("trash", async () => {
      const next = neighbour(doc.path);
      const trashed = await api("doc:trash", doc.path);
      select(next);
      await refreshTrash();
      show(`Moved “${trashed.meta.title}” to trash`, {
        label: "Undo",
        run: async () => {
          const res = await api("trash:restore", trashed.path);
          await refreshTrash();
          select(res.path);
          show(`Restored “${res.meta.title}”`);
        },
      });
    });
  }, [doc, once, select, refreshTrash, show, neighbour]);

  const restore = useCallback(async () => {
    if (!doc || !isTrashed(doc.path)) return;
    await once("restore", async () => {
      const next = neighbour(doc.path);
      const res = await api("trash:restore", doc.path);
      select(next);
      await refreshTrash();
      show(`Restored “${res.meta.title}”`);
    });
  }, [doc, once, select, refreshTrash, show, neighbour]);

  const purge = useCallback(async () => {
    if (!doc || !isTrashed(doc.path)) return;
    await once("purge", async () => {
      const next = neighbour(doc.path);
      const { removed, assets } = await api("trash:purge", doc.path);
      // Main asks for confirmation first. Saying no has to leave everything as it was —
      // including the selection, which used to be cleared either way.
      if (!removed) return;
      select(next);
      await refreshTrash();
      const images = assets.length ? ` and ${plural(assets.length, "image")}` : "";
      show(`Deleted “${doc.title}”${images} from the vault`);
    });
  }, [doc, once, select, refreshTrash, show, neighbour]);

  return { trash, restore, purge, busy };
}
