import { GitBranch } from "lucide-react";
import { Button, Kbd } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import type { EditorFooterProps } from "./editor-footer.types";

export function EditorFooter({
  pathPreview,
  hasRemote,
  saving,
  canSave,
  dirty,
  persisted,
  error,
  keptOtherVersion,
  onSave,
}: EditorFooterProps) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-t border-line bg-paper-2 px-5 py-2 text-xs text-ink-3">
      <span className="shrink-0">saves to</span>
      <span className="truncate font-mono text-ink-2">{pathPreview}</span>

      {/* Wraps rather than truncates: why the save failed is the part you need to read. */}
      {error && <span className="ml-2 min-w-0 wrap-break-word text-cherry">{error}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Someone else had written this file since it was opened here. Their version was
            committed before this one, so the only thing left to do is say where it went. */}
        {keptOtherVersion && !dirty && (
          <span className="flex items-center gap-1.5 text-warn-2">
            <GitBranch size={11} /> This file had changed — the other version is in its history
          </span>
        )}
        {persisted && !dirty && !error && !keptOtherVersion && (
          <span className="text-ink-4">Saved</span>
        )}
        <Button
          variant="ghost"
          disabled={!canSave}
          loading={saving === "local"}
          onClick={() => onSave("local")}
        >
          Save without committing
        </Button>
        <Button
          variant="primary"
          disabled={!canSave}
          loading={saving === "commit"}
          onClick={() => onSave("commit")}
        >
          {hasRemote ? "Save & commit to main" : "Save & commit"} <Kbd>{MOD_KEY}↵</Kbd>
        </Button>
      </div>
    </div>
  );
}
