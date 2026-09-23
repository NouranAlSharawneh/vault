import { useCallback, useEffect, useState } from "react";
import { AssetPanel, useAssetPlan } from "@/components/asset-panel";
import { AuthExpiredBanner } from "@/components/auth-expired-banner/auth-expired-banner.component";
import { Markdown } from "@/components/markdown";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { SectionLabel, SplitPane } from "@/components/ui";
import { EDITOR_PLACEHOLDER } from "@/data/editor.data";
import { parentDir, plural } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { countWords } from "@shared/helpers";
import { EditorFooter } from "./components/editor-footer/editor-footer.component";
import { MarkdownEditor } from "./components/markdown-editor/markdown-editor.component";
import { MetadataBar } from "./components/metadata-bar/metadata-bar.component";
import { OpenFailed } from "./components/open-failed/open-failed.component";
import { useUnsavedGuard } from "./components/unsaved-guard/hooks/use-unsaved-guard.hook";
import { UnsavedGuard } from "./components/unsaved-guard/unsaved-guard.component";
import type { SaveMode } from "./editor.types";
import { useEditorDraft } from "./hooks/use-editor-draft.hook";
import { readEditorTarget, useEditorOpen } from "./hooks/use-editor-open.hook";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts.hook";

/** Full save window: raw markdown left, live preview right, metadata bar and actions below. */
export function Editor() {
  const [target] = useState(readEditorTarget);
  const d = useEditorDraft(target.draftKey);
  const index = useApp((s) => s.index);
  const config = useApp((s) => s.config);

  const opened = useEditorOpen(target, {
    onDoc: d.loadDoc,
    onDraft: d.loadDraft,
    onRecover: d.recoverDraft,
  });
  // Until the document is in, a save would have no path and write a new file beside it.
  const ready = opened.status.kind === "ready";
  const plan = useAssetPlan({
    body: d.body,
    project: d.meta.project,
    sourceDir: d.sourcePath ? parentDir(d.sourcePath) : null,
  });
  const guard = useUnsavedGuard(d.dirty);
  /**
   * Save, then close at once. This used to hold the window open for the "Saved" flash,
   * which read as the window refusing to go; the main window shows the result anyway.
   */
  const saveAndClose = useCallback(
    (mode: SaveMode) => {
      // Every way in comes through here — the buttons, ⌘↵ in the text, File → Save.
      if (!ready) return;
      fire(
        d.save(mode, plan.request).then((r) => {
          if (!r) return;
          // Same as the capture sheet: hand the new doc to the main window on the way out.
          fire(api("window:revealDoc", r.path), "Saved, but couldn't reveal it");
          guard.closeNow();
        }),
      );
    },
    [ready, d, plan.request, guard],
  );
  const commit = useCallback(() => saveAndClose("commit"), [saveAndClose]);
  useEditorShortcuts({
    onSave: commit,
    // Nothing to lose: go straight out. Otherwise ask, the same as clicking the X.
    onEscape: useCallback(() => (d.dirty ? guard.prompt() : guard.closeNow()), [d.dirty, guard]),
  });

  useEffect(() => {
    const name = d.effectiveTitle || target.path || "New document";
    document.title = `${name}${d.dirty ? " •" : ""} — Vault`;
  }, [d.effectiveTitle, d.dirty, target.path]);

  const projects = index?.projects.filter((p) => p.slug !== "_inbox").map((p) => p.name) ?? [];
  const tags = index?.tags.map((t) => t.tag) ?? [];

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between pr-4 pl-titlebar drag">
        <span className="text-sm text-ink-3">
          {d.existingPath ?? target.path ?? "New document"}
        </span>
        <div className="flex items-center gap-3 no-drag">
          <SyncBadge />
        </div>
      </div>
      <AuthExpiredBanner />
      {opened.status.kind === "failed" ? (
        <OpenFailed
          path={opened.status.path}
          reason={opened.status.reason}
          retrying={opened.status.retrying}
          onRetry={opened.retry}
          onClose={guard.closeNow}
        />
      ) : (
        <>
          <SplitPane
            className="flex-1"
            storageKey="editor-split"
            left={
              <>
                <div className="flex h-8 shrink-0 items-center justify-between px-6">
                  <SectionLabel>Markdown</SectionLabel>
                  <span className="text-2xs text-ink-4">{plural(countWords(d.body), "word")}</span>
                </div>
                <MarkdownEditor
                  value={d.body}
                  onChange={d.setBody}
                  onSubmit={commit}
                  placeholder={EDITOR_PLACEHOLDER}
                  autoFocus
                />
              </>
            }
            right={
              <>
                <div className="flex h-8 shrink-0 items-center px-6">
                  <SectionLabel>Preview</SectionLabel>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-16">
                  {d.body.trim() ? (
                    <Markdown source={d.body} docPath={d.existingPath ?? d.pathPreview} />
                  ) : (
                    <div className="text-sm text-ink-4">Nothing to preview yet.</div>
                  )}
                </div>
              </>
            }
          />
          <AssetPanel plan={plan} className="mx-4 mb-2" />
          <MetadataBar
            meta={d.meta}
            inferredTitle={d.inferredTitle}
            onChange={d.setMeta}
            projects={projects}
            tags={tags}
            lastProject={config?.lastProject ?? null}
          />
          <EditorFooter
            pathPreview={d.pathPreview}
            hasRemote={!!config?.remote}
            saving={d.saving}
            canSave={d.canSave && ready}
            dirty={d.dirty}
            error={d.error}
            keptOtherVersion={!!d.lastSaved?.preservedExternalEdit}
            onSave={saveAndClose}
          />
        </>
      )}
      <UnsavedGuard
        open={guard.prompting}
        onKeepEditing={guard.dismiss}
        onDiscard={() => {
          // Discard means discard: the parked copy goes too, or it would come straight
          // back the next time this document was opened.
          d.discardDraft();
          guard.closeNow();
        }}
        onSave={commit}
        saving={d.saving === "commit"}
        error={d.error}
      />
    </div>
  );
}
