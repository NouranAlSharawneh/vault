import { useCallback } from "react";
import { errorMessage, plural } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { DocMeta } from "@shared/types";
import { isTrashed } from "./use-document.hook";

/**
 * Move to trash (with Undo), restore, and delete forever for the doc in the reader.
 * Each one refreshes the trash list and shows a toast; the selection follows the doc.
 */
export function useTrashActions(doc: DocMeta | null, select: (path: string | null) => void) {
  const show = useToast((s) => s.show);
  const refreshTrash = useApp((s) => s.refreshTrash);

  const trash = useCallback(async () => {
    if (!doc || isTrashed(doc.path)) return;
    try {
      const trashed = await api("doc:trash", doc.path);
      select(null);
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
    } catch (e) {
      show(errorMessage(e));
    }
  }, [doc, select, refreshTrash, show]);

  const restore = useCallback(async () => {
    if (!doc || !isTrashed(doc.path)) return;
    try {
      const res = await api("trash:restore", doc.path);
      select(null);
      await refreshTrash();
      show(`Restored “${res.meta.title}”`);
    } catch (e) {
      show(errorMessage(e));
    }
  }, [doc, select, refreshTrash, show]);

  const purge = useCallback(async () => {
    if (!doc || !isTrashed(doc.path)) return;
    try {
      const { removed, assets } = await api("trash:purge", doc.path);
      // Main asks for confirmation first. Saying no has to leave everything as it was —
      // including the selection, which used to be cleared either way.
      if (!removed) return;
      select(null);
      await refreshTrash();
      const images = assets.length ? ` and ${plural(assets.length, "image")}` : "";
      show(`Deleted “${doc.title}”${images} forever`);
    } catch (e) {
      show(errorMessage(e));
    }
  }, [doc, select, refreshTrash, show]);

  return { trash, restore, purge };
}
