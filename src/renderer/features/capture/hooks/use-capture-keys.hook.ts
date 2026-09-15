import { useEffect } from "react";

interface Handlers {
  onSave: () => void;
  onOpenEditor: () => void;
  onHide: () => void;
}

/** ⌘↵ save · ⌘E open in editor · Esc hide — active anywhere in the sheet. */
export function useCaptureKeys({ onSave, onOpenEditor, onHide }: Handlers) {
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
        onSave();
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        onOpenEditor();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, onOpenEditor, onHide]);
}
