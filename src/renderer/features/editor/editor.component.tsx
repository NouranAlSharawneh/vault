import { useCallback, useEffect, useState } from "react";
import { countWords } from "@shared/helpers";
import { AssetPanel, useAssetPlan } from "@/components/asset-panel";
import { AuthExpiredBanner } from "@/components/auth-expired-banner/auth-expired-banner.component";
import { Markdown } from "@/components/markdown";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { SectionLabel, SplitPane } from "@/components/ui";
import { CAPTURE_SAVED_FLASH_MS } from "@/constants";
import { EDITOR_PLACEHOLDER } from "@/data/editor.data";
import { parentDir, plural } from "@/helpers";
import { useApp } from "@/stores/app";
import type { SaveMode } from "./editor.types";
import { useEditorDraft } from "./hooks/use-editor-draft.hook";
import { useEditorOpen } from "./hooks/use-editor-open.hook";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts.hook";
import { MarkdownEditor } from "./components/markdown-editor/markdown-editor.component";
import { MetadataBar } from "./components/metadata-bar/metadata-bar.component";
import { EditorFooter } from "./components/editor-footer/editor-footer.component";
import { UnsavedGuard } from "./components/unsaved-guard/unsaved-guard.component";

/** Full save window: raw markdown left, live preview right, metadata bar and actions below. */
export function Editor() {
  const d = useEditorDraft();
  const index = useApp((s) => s.index);
  const config = useApp((s) => s.config);
  const [discarding, setDiscarding] = useState(false);

  useEditorOpen({ onDoc: d.loadDoc, onDraft: d.loadDraft });
  const plan = useAssetPlan({
    body: d.body,
    project: d.meta.project,
    sourceDir: d.sourcePath ? parentDir(d.sourcePath) : null,
  });
  /** Save, then close the window — the main window already shows the result. */
  const saveAndClose = useCallback(
    (mode: SaveMode) =>
      void d
        .save(mode, plan.request)
        .then((r) => r && setTimeout(() => window.close(), CAPTURE_SAVED_FLASH_MS)),
    [d, plan.request],
  );
  const commit = useCallback(() => saveAndClose("commit"), [saveAndClose]);
  useEditorShortcuts(commit);

  useEffect(() => {
    document.title = `${d.effectiveTitle || "New document"}${d.dirty ? " •" : ""} — Vault`;
  }, [d.effectiveTitle, d.dirty]);

  const projects = index?.projects.filter((p) => p.slug !== "_inbox").map((p) => p.name) ?? [];
  const tags = index?.tags.map((t) => t.tag) ?? [];

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between pr-4 pl-20 drag">
        <span className="text-sm text-ink-3">{d.existingPath ?? "New document"}</span>
        <div className="flex items-center gap-3 no-drag">
          <SyncBadge />
        </div>
      </div>
      <AuthExpiredBanner />
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
                <Markdown source={d.body} />
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
        canSave={d.canSave}
        dirty={d.dirty}
        error={d.error}
        onSave={saveAndClose}
      />
      <UnsavedGuard
        dirty={d.dirty && !discarding}
        onDiscard={() => {
          setDiscarding(true);
          d.markClean();
          setTimeout(() => window.close(), 0);
        }}
        onSave={() => commit()}
      />
    </div>
  );
}
