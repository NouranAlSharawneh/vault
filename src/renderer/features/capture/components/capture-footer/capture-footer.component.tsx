import { Check } from "lucide-react";
import { useRef } from "react";
import { Button, Kbd } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { CaptureActions } from "../capture-actions/capture-actions.component";
import type { CaptureFooterProps } from "./capture-footer.types";

/**
 * The sheet's action bar: where the doc is going on the left, and exactly two controls on
 * the right — save, and the ⌘K menu that holds every other action with its shortcut.
 * It used to be two buttons, three key caps and a caption line for a third action.
 */
export function CaptureFooter({
  pathPreview,
  project,
  phase,
  error,
  savedPath,
  saveLabel,
  actions,
  actionsOpen,
  onActionsOpenChange,
  onSave,
  onRetry,
}: CaptureFooterProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const file = pathPreview.split("/").pop() ?? "";

  const close = () => {
    onActionsOpenChange(false);
    trigger.current?.focus();
  };

  return (
    <div className="relative flex min-h-12 items-center gap-2 rounded-b-lg border-t border-overlay-line bg-white/[0.025] py-2 pr-2 pl-5">
      <div className="min-w-0 flex-1 truncate text-sm text-overlay-ink-3">
        {phase === "saved" ? (
          <span className="flex items-center gap-1.5 text-ok">
            <Check size={13} /> Committed{" "}
            <span className="truncate font-mono text-xs">{savedPath}</span>
          </span>
        ) : phase === "error" ? (
          <span className="text-cherry-3">{error}</span>
        ) : (
          <span title={pathPreview}>
            Save to <span className="text-overlay-ink-2">{project.trim() || "Inbox"}</span>
            {file && (
              <>
                {" "}
                › <span className="font-mono text-xs text-overlay-ink">{file}</span>
              </>
            )}
          </span>
        )}
      </div>
      {phase === "error" ? (
        <Button variant="link" onClick={onRetry}>
          Try again
        </Button>
      ) : (
        <>
          <Button
            variant="primary"
            loading={phase === "saving"}
            disabled={phase !== "ready"}
            onClick={(e) => onSave(e.altKey)}
          >
            {saveLabel} <Kbd dark>{MOD_KEY}↵</Kbd>
          </Button>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-overlay-line" />
          <Button
            ref={trigger}
            variant="ghost"
            aria-haspopup="menu"
            aria-expanded={actionsOpen}
            className="text-overlay-ink-2 hover:bg-overlay-3 hover:text-overlay-ink aria-expanded:bg-overlay-3 aria-expanded:text-overlay-ink"
            onClick={() => onActionsOpenChange(!actionsOpen)}
          >
            Actions <Kbd dark>{MOD_KEY}K</Kbd>
          </Button>
          {actionsOpen && <CaptureActions actions={actions} onClose={close} />}
        </>
      )}
    </div>
  );
}
