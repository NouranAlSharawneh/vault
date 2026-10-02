import { Button, Kbd } from "@/components/ui";
import { acceleratorLabel, cx } from "@/helpers";
import { fire } from "@/lib/api";
import { useHotkeyRecorder } from "./hooks/use-hotkey-recorder.hook";
import type { HotkeyRecorderProps } from "./hotkey-recorder.types";

/** Click, press the combination you want, done. */
export function HotkeyRecorder({ value, onChange, busy }: HotkeyRecorderProps) {
  const r = useHotkeyRecorder((a) => {
    const saved = onChange(a);

    if (saved) fire(saved);
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        className={cx(
          "w-42 justify-center font-mono",
          r.recording && "border-cherry bg-cherry-tint",
        )}
        onClick={r.start}
        onBlur={r.stop}
        onKeyDown={r.onKeyDown}
        loading={busy}
        // The visible shortcut is part of the name, so it is read out, not just "button".
        aria-label={
          r.recording
            ? "Recording the capture shortcut. Press a combination, or Escape to cancel"
            : `Capture shortcut, ${acceleratorLabel(value)}`
        }
        aria-pressed={r.recording}
      >
        {r.recording ? (
          <span className="text-cherry">press keys…</span>
        ) : (
          <Kbd>{acceleratorLabel(value)}</Kbd>
        )}
      </Button>
      <span role="status" className="max-w-56 text-right text-2xs text-cherry">
        {r.hint}
      </span>
    </div>
  );
}
