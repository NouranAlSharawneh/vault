import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AssetPanel, useAssetPlan } from "@/components/asset-panel";
import { AuthExpiredBanner } from "@/components/auth-expired-banner/auth-expired-banner.component";
import { Markdown } from "@/components/markdown";
import { NoWriteAccessBanner } from "@/components/no-write-access-banner/no-write-access-banner.component";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { SectionLabel, SplitPane } from "@/components/ui";
import { EDITOR_PLACEHOLDER } from "@/data/editor.data";
import { parentDir, renameHint } from "@/helpers";
import { api, fire, fireQuietly, on } from "@/lib/api";
import { useApp } from "@/stores/app";
import { countWords } from "@shared/helpers";
import type { SavedNotice } from "@shared/types";
import { EditorBanners } from "./components/editor-banners/editor-banners.component";
import { EditorFooter } from "./components/editor-footer/editor-footer.component";
import { EditorPanels } from "./components/editor-panels/editor-panels.component";
import type { EditorPanel } from "./components/editor-panels/editor-panels.types";
import { MarkdownEditor } from "./components/markdown-editor/markdown-editor.component";
import type { MarkdownEditorHandle } from "./components/markdown-editor/markdown-editor.types";
import { MarkdownPaneHeader } from "./components/markdown-pane-header/markdown-pane-header.component";
import { MetadataBar } from "./components/metadata-bar/metadata-bar.component";
import { OpenFailed } from "./components/open-failed/open-failed.component";
import { TitleField } from "./components/title-field/title-field.component";
import { useUnsavedGuard } from "./components/unsaved-guard/hooks/use-unsaved-guard.hook";
import { UnsavedGuard } from "./components/unsaved-guard/unsaved-guard.component";
import type { SaveMode } from "./editor.types";
import { useDocumentEdited } from "./hooks/use-document-edited.hook";
import { useEditorDraft } from "./hooks/use-editor-draft.hook";
import { readEditorTarget, useEditorOpen } from "./hooks/use-editor-open.hook";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts.hook";
import { useFocusMode } from "./hooks/use-focus-mode.hook";
import { useImageStaging } from "./hooks/use-image-staging.hook";

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
  // The preview, the word count and the image scan follow the text at their own pace: on
  // a large document each keystroke re-ran the whole markdown pipeline before it showed.
  const settledBody = useDeferredValue(d.body);
  const words = useMemo(() => countWords(settledBody), [settledBody]);
  const [selectedWords, setSelectedWords] = useState(0);
  const text = useRef<MarkdownEditorHandle>(null);
  const stageImage = useImageStaging();
  const { focusMode, toggleFocusMode } = useFocusMode();
  const [panel, setPanel] = useState<EditorPanel | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const renameTo = useMemo(
    () => renameHint(d.existingPath, d.pathPreview),
    [d.existingPath, d.pathPreview],
  );
  const home = docFolder(config?.root, d.existingPath);
  const plan = useAssetPlan({
    body: settledBody,
    project: d.meta.project,
    sourceDir: d.sourcePath ? parentDir(d.sourcePath) : home,
    homeDir: home,
  });
  const guard = useUnsavedGuard(d.dirty);
  useDocumentEdited(d.dirty);
  // Trashed from the main window while open here: said, so a save that brings it back is
  // a choice rather than a surprise.
  const [gone, setGone] = useState(false);
  const holding = d.existingPath;
  useEffect(() => on("editor:docGone", ({ path }) => path === holding && setGone(true)), [holding]);
  /**
   * Save, then close at once. This used to hold the window open for the "Saved" flash,
   * which read as the window refusing to go — so what the save did travels with the
   * document to the main window, which says it there.
   */
  const saveAndClose = useCallback(
    (mode: SaveMode) => {
      // Every way in comes through here — the buttons, ⌘↵ in the text, File → Save.
      if (!ready) return;
      fire(
        d.save(mode, plan.request).then((r) => {
          if (!r) return;
          const before = d.existingPath;
          const saved: SavedNotice = {
            title: r.meta.title,
            outcome: !r.changed
              ? "unchanged"
              : !before
                ? "added"
                : r.path !== before
                  ? "moved"
                  : "updated",
            committed: r.committed,
            keptOtherVersion: !!r.preservedExternalEdit,
          };
          // Same as the capture sheet: hand the doc to the main window on the way out.
          fire(
            api("window:revealDoc", r.path, saved),
            "Saved, but couldn’t show it in the main window",
          );
          guard.closeNow();
        }),
      );
    },
    [ready, d, plan.request, guard],
  );
  const commit = useCallback(() => saveAndClose("commit"), [saveAndClose]);
  /** ⌘S: commit and keep writing. The footer says "Saved". */
  const commitAndStay = useCallback(() => {
    if (ready) fire(d.save("commit", plan.request));
  }, [ready, d, plan.request]);
  useEditorShortcuts({
    onSave: commitAndStay,
    onSaveClose: commit,
    // Nothing to lose: go straight out. Otherwise ask, the same as clicking the X.
    onEscape: useCallback(() => (d.dirty ? guard.prompt() : guard.closeNow()), [d.dirty, guard]),
    onFocusMode: toggleFocusMode,
    onOutline: useCallback(() => setPanel("outline"), []),
  });

  // Main finds this window by its document, so opening that document again focuses it —
  // including after the first save gives a new one a path, or a save renames it.
  useEffect(() => {
    if (d.existingPath) {
      fireQuietly(api("editor:setPath", d.existingPath), "telling main this window's document");
    }
  }, [d.existingPath]);

  useEffect(() => {
    const name = d.effectiveTitle || target.path || "New document";
    document.title = `${name}${d.dirty ? " •" : ""} — Marasca`;
  }, [d.effectiveTitle, d.dirty, target.path]);

  const projects = index?.projects.filter((p) => p.slug !== "_inbox").map((p) => p.name) ?? [];
  const tags = index?.tags.map((t) => t.tag) ?? [];

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between pr-5 pl-titlebar drag">
        <span className="text-sm text-ink-3">
          {d.existingPath ?? target.path ?? "New document"}
        </span>
        <div className="flex items-center gap-3 no-drag">
          <SyncBadge />
        </div>
      </div>
      <AuthExpiredBanner />
      <NoWriteAccessBanner />
      <EditorBanners
        gone={gone}
        // Unsaved text still gets its question.
        onClose={() => (d.dirty ? guard.prompt() : guard.closeNow())}
        staleDraft={d.staleDraft}
        onStaleDraft={d.resolveStaleDraft}
      />
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
          <TitleField
            value={d.meta.title}
            inferredTitle={d.inferredTitle}
            onChange={(title) => d.setMeta({ title })}
            renameTo={renameTo}
          />
          <SplitPane
            className="flex-1 border-t border-line"
            storageKey="editor-split"
            // Focus mode folds the preview away; the text stays mounted, cursor and all.
            collapsed={focusMode}
            left={
              // A group, so the way out of the text shows only while you are in it.
              <div className="group/md flex min-h-0 flex-1 flex-col">
                {/* Labels start on the text's own column, in both panes. */}
                <MarkdownPaneHeader
                  words={words}
                  selectedWords={selectedWords}
                  focusMode={focusMode}
                  onFocusMode={toggleFocusMode}
                  onShortcuts={() => setPanel("shortcuts")}
                />
                <MarkdownEditor
                  ref={text}
                  value={d.body}
                  onChange={d.setBody}
                  onSubmit={commit}
                  onImage={stageImage}
                  onSelectionWords={setSelectedWords}
                  placeholder={EDITOR_PLACEHOLDER}
                  readOnly={!!d.saving}
                  autoFocus
                />
              </div>
            }
            right={
              <>
                <div className="flex h-8 shrink-0 items-center px-measure">
                  <SectionLabel>Preview</SectionLabel>
                </div>
                {/* pt-5: the preview's first line sits level with the editor's. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-measure pt-5 pb-16">
                  <article className="mx-auto max-w-170">
                    {settledBody.trim() ? (
                      <Markdown source={settledBody} docPath={d.existingPath ?? d.pathPreview} />
                    ) : (
                      <div className="text-sm text-ink-4">Nothing to preview yet.</div>
                    )}
                  </article>
                </div>
              </>
            }
          />
          <AssetPanel plan={plan} className="mx-5 mb-2" />
          <MetadataBar
            meta={d.meta}
            onChange={d.setMeta}
            projects={projects}
            tags={tags}
            // "last used" explains a new document's default. On a saved one the project is
            // its own, whatever the last capture was.
            lastProject={d.existingPath ? null : (config?.lastProject ?? null)}
          />
          <EditorFooter
            pathPreview={d.pathPreview}
            hasRemote={!!config?.remote}
            branch={config?.branch ?? "main"}
            saving={d.saving}
            canSave={d.canSave && ready}
            dirty={d.dirty}
            persisted={!!d.existingPath}
            error={d.error}
            keptOtherVersion={!!d.lastSaved?.preservedExternalEdit}
            onSave={saveAndClose}
          />
        </>
      )}
      <EditorPanels
        panel={panel}
        body={d.body}
        onJump={(line) => text.current?.jumpToLine(line)}
        onClose={closePanel}
      />
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

/**
 * The folder a vault document's relative images resolve against: its own. Without it an
 * existing document's `assets/x.png` was looked for elsewhere — reported missing, or
 * found in the vault by Spotlight and copied in again as `x-2.png` on every save.
 */
function docFolder(root: string | undefined, path: string | null): string | null {
  if (!root || !path) return null;

  return path.includes("/") ? `${root}/${parentDir(path)}` : root;
}
