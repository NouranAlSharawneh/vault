import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Guards the window close while there are unsaved changes, and owns the one way out.
 *
 * `beforeunload` fires again on the `window.close()` we make ourselves, so discarding
 * has to disarm the guard first. A ref does that synchronously — waiting for React to
 * re-run the effect cleanup left the listener attached, the second close was blocked
 * too, and the window just sat there.
 */
export function useUnsavedGuard(dirty: boolean) {
  const [prompting, setPrompting] = useState(false);
  const allowClose = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (allowClose.current) return;
      e.preventDefault();
      setPrompting(true);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /** Close now, unsaved changes and all. */
  const closeNow = useCallback(() => {
    allowClose.current = true;
    window.close();
  }, []);

  return {
    prompting,
    prompt: useCallback(() => setPrompting(true), []),
    dismiss: useCallback(() => setPrompting(false), []),
    closeNow,
  };
}
