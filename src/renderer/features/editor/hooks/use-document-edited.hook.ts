import { useEffect } from "react";
import { api, fireQuietly } from "@/lib/api";

/**
 * Tell the window whether it has unsaved changes, so macOS shows the dot in its close
 * button the way every other document window does. Sent only when it changes; main
 * ignores it on other platforms.
 */
export function useDocumentEdited(dirty: boolean): void {
  useEffect(() => {
    fireQuietly(api("window:setEdited", dirty), "marking the window edited");
  }, [dirty]);
}
