import { Button, Empty } from "@/components/ui";
import type { OpenFailedProps } from "./open-failed.types";

/**
 * In place of the editor when the document could not be read. The window used to open
 * as an empty "New document" instead, and saving it wrote a second file beside the one
 * that failed to open.
 */
export function OpenFailed({ path, reason, retrying, onRetry, onClose }: OpenFailedProps) {
  return (
    <Empty
      tone="error"
      className="flex-1"
      title={`Couldn’t open ${path}.`}
      hint="Nothing can be saved from this window until the document opens, so the file stays exactly as it is."
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" loading={retrying} onClick={onRetry}>
            Try again
          </Button>
        </div>
      }
    >
      <p className="mt-2 max-w-sm font-mono text-xs wrap-break-word text-ink-3 select-text">
        {reason}
      </p>
    </Empty>
  );
}
