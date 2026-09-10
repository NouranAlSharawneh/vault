import { useEffect, useState } from "react";

/**
 * Blocks the window close while there are unsaved changes and surfaces a prompt.
 * Electron honours `preventDefault` on beforeunload; we render our own sheet.
 */
export function useUnsavedGuard(dirty: boolean) {
  const [prompting, setPrompting] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      setPrompting(true);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return { prompting, dismiss: () => setPrompting(false) };
}
