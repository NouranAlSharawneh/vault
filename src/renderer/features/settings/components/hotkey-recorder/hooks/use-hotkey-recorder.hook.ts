import { useCallback, useState, type KeyboardEvent } from "react";
import { toAccelerator } from "@/helpers";

/** Focus → "press keys" → a modifier+key combination → onChange. Esc cancels. */
export function useHotkeyRecorder(onChange: (accelerator: string) => void) {
  const [recording, setRecording] = useState(false);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);

        return;
      }
      const accel = toAccelerator(e.nativeEvent);
      if (!accel) return;
      setRecording(false);
      onChange(accel);
    },
    [recording, onChange],
  );

  return {
    recording,
    start: () => setRecording(true),
    stop: () => setRecording(false),
    onKeyDown,
  };
}
