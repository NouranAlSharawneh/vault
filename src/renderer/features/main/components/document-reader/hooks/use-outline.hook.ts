import { type RefObject, useCallback, useState } from "react";
import { scrollToAnchor } from "@/helpers";
import type { OutlineHeading } from "../components/document-outline/document-outline.types";
import { outlineOf } from "../components/document-outline/outline-of";

/**
 * The outline popover: read from the rendered document when it opens, so it is always the
 * headings on screen, and closed by opening another document (it belongs to the one it
 * was read from).
 */
export function useOutline(root: RefObject<HTMLElement | null>, path: string | undefined) {
  const [shown, setShown] = useState<{ path: string; headings: OutlineHeading[] } | null>(null);
  const open = !!shown && shown.path === path;

  const toggle = useCallback(() => {
    if (open || !path) {
      setShown(null);

      return;
    }
    setShown({ path, headings: outlineOf(root.current) });
  }, [open, path, root]);

  const close = useCallback(() => setShown(null), []);

  const pick = useCallback(
    (id: string) => {
      const prose = root.current?.querySelector(".prose-doc");
      if (prose) scrollToAnchor(prose, id, "");
      setShown(null);
      // Reading goes on from the section, so Space and Page Down continue from there.
      root.current
        ?.querySelector<HTMLElement>("[data-doc-scroller]")
        ?.focus({ preventScroll: true });
    },
    [root],
  );

  return { open, headings: open ? shown.headings : [], toggle, close, pick };
}
