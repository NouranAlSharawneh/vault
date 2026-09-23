import { Button } from "@/components/ui";
import type { OpenFailedProps } from "./open-failed.types";

/**
 * In place of the editor when the document could not be read. The window used to open
 * as an empty "New document" instead, and saving it wrote a second file beside the one
 * that failed to open.
 */
export function OpenFailed({ path, reason, retrying, onRetry, onClose }: OpenFailedProps) {
  return (
    <div
      role="alert"
      className="flex flex-1 animate-fade-in flex-col items-center justify-center px-8 text-center"
    >
      <div className="font-serif text-xl font-medium text-ink">Couldn&rsquo;t open {path}.</div>
      <p className="mt-2 max-w-100 font-mono text-xs break-words text-cherry">{reason}</p>
      <p className="mt-3 max-w-100 text-sm text-ink-3">
        Nothing can be saved from this window until the document opens, so the file stays exactly as
        it is.
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" loading={retrying} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
