import { useEffect, useRef } from "react";
import { isEditableTarget } from "@/helpers";
import type { DocMeta } from "@shared/types";

/**
 * ⌥↑ and ⌥↓ read the previous or next document in the list from anywhere in the window
 * — the reader included, where the arrows alone scroll the text. Not while typing, and
 * not with a dialog up.
 */
export function useAdjacentDoc(
  listed: DocMeta[],
  selected: string | null,
  select: (path: string) => void,
) {
  const latest = useRef({ listed, selected, select });
  useEffect(() => {
    latest.current = { listed, selected, select };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (isEditableTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const { listed: docs, selected: at, select: go } = latest.current;
      const i = docs.findIndex((d) => d.path === at);
      const next = docs[e.key === "ArrowDown" ? i + 1 : i < 0 ? 0 : i - 1];
      if (!next) return;
      e.preventDefault();
      go(next.path);
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
