import { useCallback, useRef } from "react";
import { errorMessage, plural } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useLibrary } from "@/stores/library";
import { useToast } from "@/stores/toast";
import type { DocMeta, TrashedDoc } from "@shared/types";

/** Where the selection lands once `gone` leaves the list: the next row after them, or before. */
export function landingAfter(listed: DocMeta[], gone: Set<string>): string | null {
  const first = listed.findIndex((d) => gone.has(d.path));
  if (first < 0) return null;
  const after = listed.slice(first).find((d) => !gone.has(d.path));
  const before = listed
    .slice(0, first)
    .reverse()
    .find((d) => !gone.has(d.path));

  return (after ?? before)?.path ?? null;
}

const named = (docs: { title: string }[]) =>
  docs.length === 1 ? `“${docs[0].title}”` : plural(docs.length, "document");

/**
 * Star, unstar and trash for any number of documents — a ⌘-click selection, or the one
 * row a menu was opened on. One at a time underneath: each is a commit, and the vault
 * takes them in turn anyway. A trash says how many went and can put them all back.
 */
export function useBulkActions(
  listed: DocMeta[],
  select: (path: string | null) => void,
  pick: (paths: string[]) => void,
) {
  const show = useToast((s) => s.show);
  const refreshTrash = useApp((s) => s.refreshTrash);
  const inFlight = useRef(false);

  const trash = useCallback(
    async (paths: string[]) => {
      if (inFlight.current || !paths.length) return;
      inFlight.current = true;
      const next = landingAfter(listed, new Set(paths));
      const trashed: TrashedDoc[] = [];
      try {
        for (const p of paths) trashed.push(await api("doc:trash", p));
      } catch (e) {
        show(errorMessage(e));
      } finally {
        inFlight.current = false;
      }
      if (!trashed.length) return;
      pick([]);
      select(next);
      await refreshTrash();
      show(`Moved ${named(trashed.map((t) => t.meta))} to trash`, {
        label: "Undo",
        run: async () => {
          for (const t of trashed) await api("trash:restore", t.path);
          await refreshTrash();
          show(`Restored ${named(trashed.map((t) => t.meta))}`);
        },
      });
    },
    [listed, pick, select, refreshTrash, show],
  );

  const star = useCallback(
    async (paths: string[], starred: boolean) => {
      try {
        for (const p of paths) {
          // Asked before the call: the index can report the file gone (and the list move
          // the selection off it) before the star itself comes back.
          const inReader = useLibrary.getState().selected === p;
          const meta = await api("doc:setStarred", p, starred);
          // A star is a save, and a save can give the file its title's name. The reader
          // follows it there: it used to lose the document and jump to the top of the list.
          if (meta.path !== p && inReader) select(meta.path);
        }
        if (paths.length > 1)
          show(`${starred ? "Starred" : "Unstarred"} ${plural(paths.length, "document")}`);
      } catch (e) {
        show(errorMessage(e));
      }
    },
    [show, select],
  );

  return { trash, star };
}
