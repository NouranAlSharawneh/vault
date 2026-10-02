import { GitBranch } from "lucide-react";
import { Button, Kbd } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { plainError } from "@/helpers";
import type { EditorFooterProps } from "./editor-footer.types";

export function EditorFooter({
  pathPreview,
  hasRemote,
  branch,
  saving,
  canSave,
  dirty,
  persisted,
  error,
  keptOtherVersion,
  onSave,
}: EditorFooterProps) {
  return (
    <div className="border-t border-line bg-paper-2">
      {/* Its own row, wrapped rather than squeezed: why the save failed is the part you
          need to read, and beside the path it crushed the path to a dozen letters. */}
      {error && (
        <div
          className="border-b border-line bg-cherry-tint px-5 py-2 text-xs text-cherry"
          role="alert"
          title={error}
        >
          {plainError(error)}
        </div>
      )}
      <div className="flex min-h-11 items-center gap-3 px-5 py-2 text-xs text-ink-3">
        <span className="shrink-0">saves to</span>
        <span className="min-w-0 truncate font-mono text-ink-2" title={pathPreview}>
          {pathPreview}
        </span>
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
            tooltip={`Commits and closes. ${MOD_KEY}S commits and keeps writing.`}
          >
            {hasRemote ? `Save & commit to ${branch}` : "Save & commit"} <Kbd>{MOD_KEY}↵</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
