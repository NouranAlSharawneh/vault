import { useEffect } from "react";
import { acceleratorLabel } from "@/helpers";
import { api } from "@/lib/api";
import { useToast } from "@/stores/toast";

/**
 * Say once, when the window opens, that the capture shortcut isn't bound. The OS refuses
 * a shortcut another app already holds, and until this the only symptom was pressing it
 * and nothing happening.
 */
export function useHotkeyWarning(openSettings: () => void): void {
  const show = useToast((s) => s.show);
  useEffect(() => {
    let live = true;
    api("hotkey:status")
      .then(({ accelerator, active }) => {
        if (!live || active || !accelerator) return;
        show(
          `${acceleratorLabel(accelerator)} is taken by another app. Pick a different shortcut.`,
          {
            label: "Open Settings",
            run: openSettings,
          },
        );
      })
      // If main can't say, there is nothing reliable to warn about.
      .catch(() => undefined);

    return () => {
      live = false;
    };
    // Both are stable, so this runs once per window.
  }, [show, openSettings]);
}
