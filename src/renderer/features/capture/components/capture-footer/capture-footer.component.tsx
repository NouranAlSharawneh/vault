import { Check } from "lucide-react";
import { Button, Kbd } from "@/components/ui";
import { ALT_KEY, MOD_KEY } from "@/constants";
import type { CaptureFooterProps } from "./capture-footer.types";

export function CaptureFooter({
  pathPreview,
  phase,
  error,
  savedPath,
  hasRemote,
  stranded,
  onOpenEditor,
  onSave,
  onRetry,
}: CaptureFooterProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-overlay-ink-3">
          {phase === "saved" ? (
            <span className="flex items-center gap-1.5 text-ok">
              <Check size={12} /> committed {savedPath}
            </span>
          ) : phase === "error" ? (
            <span className="text-cherry-3">{error}</span>
          ) : (
            pathPreview
          )}
        </span>
        {phase === "error" ? (
          <Button variant="link" onClick={onRetry}>
            Try again
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              className="text-overlay-ink-2 hover:bg-overlay-3 hover:text-overlay-ink"
              onClick={onOpenEditor}
            >
              Open in editor <Kbd dark>{MOD_KEY}E</Kbd>
            </Button>
            <Button
              variant="primary"
              loading={phase === "saving"}
              disabled={phase !== "ready"}
              onClick={(e) => onSave(e.altKey)}
            >
              {stranded > 0 ? "Save anyway" : hasRemote ? "Save & commit" : "Save"}{" "}
              <Kbd dark>{MOD_KEY}↵</Kbd>
            </Button>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-2xs text-overlay-ink-3">
        <Kbd dark>
          {ALT_KEY}
          {MOD_KEY}↵
        </Kbd>
        saves and opens it in Vault
      </div>
    </div>
  );
}
