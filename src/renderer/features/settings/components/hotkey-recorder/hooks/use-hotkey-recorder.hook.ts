import { useCallback, useState, type KeyboardEvent } from "react";
import { MOD_KEY } from "@/constants";
import { isModifierOnly, toAccelerator } from "@/helpers";

/** Said when a finished combination can't be a global shortcut. */
export const HOTKEY_NEEDS_MODIFIER = `Include ⌃ or ${MOD_KEY} — ⇧ or ⌥ alone would take over normal typing`;

/**
 * Focus → "press keys" → a modifier+key combination → onChange. Esc cancels, and a bare
 * Tab leaves the button as it would anywhere else rather than being recorded.
 */
export function useHotkeyRecorder(onChange: (accelerator: string) => void) {
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!recording) return;
      const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
      if (e.key === "Tab" && plain) {
        setRecording(false);

        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        setHint(null);

        return;
      }
      if (isModifierOnly(e.nativeEvent)) return;
      const accel = toAccelerator(e.nativeEvent);
      if (!accel) {
        setHint(HOTKEY_NEEDS_MODIFIER);

        return;
      }
      setRecording(false);
      setHint(null);
      onChange(accel);
    },
    [recording, onChange],
  );

  return {
    recording,
    hint,
    start: () => {
      setHint(null);
      setRecording(true);
    },
    stop: () => {
      setRecording(false);
      setHint(null);
    },
    onKeyDown,
  };
}
