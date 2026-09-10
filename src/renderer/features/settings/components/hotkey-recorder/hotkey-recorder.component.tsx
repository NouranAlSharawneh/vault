import { Button, Kbd } from "@/components/ui";
import { acceleratorLabel, cx } from "@/helpers";
import { useHotkeyRecorder } from "./hooks/use-hotkey-recorder.hook";
import type { HotkeyRecorderProps } from "./hotkey-recorder.types";

/** Click, press the combination you want, done. */
export function HotkeyRecorder({ value, onChange, busy }: HotkeyRecorderProps) {
  const r = useHotkeyRecorder((a) => void onChange(a));
  return (
    <Button
      variant="outline"
      className={cx(
        "h-8 min-w-36 justify-center font-mono",
        r.recording && "border-cherry bg-cherry-tint",
      )}
      onClick={r.start}
      onBlur={r.stop}
      onKeyDown={r.onKeyDown}
      loading={busy}
      aria-label="capture shortcut"
      aria-pressed={r.recording}
    >
      {r.recording ? (
        <span className="text-cherry">press keys…</span>
      ) : (
        <Kbd>{acceleratorLabel(value)}</Kbd>
      )}
    </Button>
  );
}
