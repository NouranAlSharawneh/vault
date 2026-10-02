import { useEffect, useRef } from "react";
import { isEditableTarget } from "@/helpers";

interface Handlers {
  /** `reveal` is true for ⌥⌘↵: save, then open the doc in Marasca. */
  onSave: (reveal: boolean) => void;
  onOpenEditor: () => void;
  /** ⌘K: open or close the actions menu. */
  onActions: () => void;
  onHide: () => void;
  /** ⌘1–⌘9: the Nth most recent project. */
  onPickProject?: (n: number) => void;
  /** `#` jumps to Tags and `@` to Project, from anywhere that isn't a text field. */
  onJump?: (field: "tags" | "project") => void;
}

/**
 * ⌘↵ save · ⌥⌘↵ save and open in Marasca · ⌘E open in editor · ⌘K actions · Esc hide ·
 * ⌘1–⌘9 a recent project · # tags · @ project — anywhere in the sheet.
 */
export function useCaptureKeys({
  onSave,
  onOpenEditor,
  onActions,
  onHide,
  onPickProject,
  onJump,
}: Handlers) {
  const latest = useRef({ onSave, onPickProject, onJump });
  useEffect(() => {
    latest.current = { onSave, onPickProject, onJump };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // A combobox or tag field dismissing its own list consumes Escape first — without
      // this check, clearing a half-typed tag also threw the whole capture away. The
      // editor window has always got this right; the sheet had not.
      if (e.key === "Escape") {
        if (!e.defaultPrevented) onHide();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        // A turn later, with the latest save: a tag typed and not yet added is added by
        // this same keypress, and the save made in the same breath didn't have it.
        const reveal = e.altKey;
        setTimeout(() => latest.current.onSave(reveal), 0);
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        onOpenEditor();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onActions();
      } else if (mod && !e.altKey && /^[1-9]$/.test(e.key) && latest.current.onPickProject) {
        e.preventDefault();
        latest.current.onPickProject(Number(e.key));
      } else if (
        !mod &&
        (e.key === "#" || e.key === "@") &&
        latest.current.onJump &&
        !isEditableTarget(e.target)
      ) {
        // The character is the shortcut, not text: it isn't typed into the field.
        e.preventDefault();
        latest.current.onJump(e.key === "#" ? "tags" : "project");
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenEditor, onActions, onHide]);
}
