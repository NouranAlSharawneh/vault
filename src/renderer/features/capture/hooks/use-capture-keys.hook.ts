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
      if (e.key === "Escape") onHide();
      else if (mod && e.key === "Enter") {
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
