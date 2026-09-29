import { useEffect } from "react";
import { acceleratorLabel } from "@/helpers";
import { api } from "@/lib/api";
import { useToast } from "@/stores/toast";

/**
 * Once per window, not once per visit to the library: Settings and back remounted it, and
 * the same toast came back every time.
 */
const WARNED_KEY = "hotkey-warned";

function warned(): boolean {
  try {
    return sessionStorage.getItem(WARNED_KEY) === "1";
  } catch {
    return false;
  }
}

function markWarned(): void {
  try {
    sessionStorage.setItem(WARNED_KEY, "1");
  } catch {
    /* storage unavailable: it may say so again */
  }
}

/**
 * Say once, when the window opens, that the capture shortcut isn't bound. The OS refuses
 * a shortcut another app already holds, and until this the only symptom was pressing it
 * and nothing happening.
 */
export function useHotkeyWarning(openSettings: () => void): void {
  const show = useToast((s) => s.show);
  useEffect(() => {
    let live = true;
    if (warned()) return;
    api("hotkey:status")
      .then(({ accelerator, active }) => {
        if (!live || active || !accelerator || warned()) return;
        markWarned();
        show(
          `${acceleratorLabel(accelerator)} is taken by another app — pick a different shortcut`,
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
