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
  error,
  keptOtherVersion,
  onSave,
}: EditorFooterProps) {
  return (
    <div className="flex h-11 items-center gap-3 border-t border-line bg-paper-2 px-5 text-xs text-ink-3">
      <span className="shrink-0">writes</span>
      <span className="truncate font-mono text-ink-2">{pathPreview}</span>
      <span className="shrink-0">with frontmatter</span>
      {error && <span className="ml-2 truncate text-cherry">{error}</span>}
      <div className="ml-auto flex items-center gap-2">
        {/* Someone else had written this file since it was opened here. Their version was
            committed before this one, so the only thing left to do is say where it went. */}
        {keptOtherVersion && !dirty && (
          <span className="flex items-center gap-1.5 text-warn-2">
            <GitBranch size={11} /> This file had changed — the other version is in its history
          </span>
        )}
        {!dirty && !error && !keptOtherVersion && <span className="text-ink-4">Saved</span>}
        <Button
          variant="ghost"
          disabled={!canSave}
          loading={saving === "local"}
          onClick={() => onSave("local")}
        >
          Save locally only
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
