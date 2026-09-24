import { useEffect } from "react";

interface Handlers {
  /** `reveal` is true for ⌥⌘↵: save, then open the doc in Marasca. */
  onSave: (reveal: boolean) => void;
  onOpenEditor: () => void;
  /** ⌘K: open or close the actions menu. */
  onActions: () => void;
  onHide: () => void;
}

/**
 * ⌘↵ save · ⌥⌘↵ save and open in Marasca · ⌘E open in editor · ⌘K actions · Esc hide —
 * anywhere in the sheet.
 */
export function useCaptureKeys({ onSave, onOpenEditor, onActions, onHide }: Handlers) {
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
        onSave(e.altKey);
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        onOpenEditor();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onActions();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, onOpenEditor, onActions, onHide]);
}
