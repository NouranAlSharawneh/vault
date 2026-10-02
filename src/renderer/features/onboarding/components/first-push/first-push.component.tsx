import { Check } from "lucide-react";
import { Dot, Spinner } from "@/components/ui";
import { useApp } from "@/stores/app";
import { firstPushLine } from "./first-push-line";

/**
 * The first push, as it happens. Done used to say "every save is a commit to …" and
 * leave you to find out from the badge, later, whether anything had reached GitHub —
 * or that the token couldn't push there at all.
 */
export function FirstPush({ remote }: { remote: string }) {
  const sync = useApp((s) => s.sync);
  const line = firstPushLine(sync, remote);

  return (
    <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-2">
      {line.tone === "busy" ? (
        <Spinner size={12} className="text-warn-2" />
      ) : line.tone === "ok" ? (
        <Check size={14} className="shrink-0 text-ok-2" />
      ) : (
        <Dot tone="bg-warn" size={8} />
      )}
      <span className={line.tone === "warn" ? "text-warn-2" : undefined}>{line.text}</span>
    </p>
  );
}
