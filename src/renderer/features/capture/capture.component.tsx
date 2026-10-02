import { ArrowDownToLine } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { AssetPanel } from "@/components/asset-panel";
import { ALT_KEY, MOD_KEY } from "@/constants";
import { plural } from "@/helpers";
import { fire, on } from "@/lib/api";
import { countWords } from "@shared/helpers";
import type { CaptureAction } from "./components/capture-actions/capture-actions.types";
import { CaptureEmpty } from "./components/capture-empty/capture-empty.component";
import { CaptureFields } from "./components/capture-fields/capture-fields.component";
import { CaptureFooter } from "./components/capture-footer/capture-footer.component";
import { CapturePreview } from "./components/capture-preview/capture-preview.component";
import { useCaptureKeys } from "./hooks/use-capture-keys.hook";
import { useCapture } from "./hooks/use-capture.hook";
import { useFitWindow } from "./hooks/use-fit-window.hook";

/**
 * ⌃⌥V sheet: clipboard → two tabs → ⌘↵, and you are back in the app you copied from.
 * Every other action (open in Marasca, open in editor, discard) is in the ⌘K menu.
 */
export function Capture() {
  const c = useCapture();
  const fit = useFitWindow<HTMLDivElement>();
  const [actionsOpen, setActionsOpen] = useState(false);
  // Something worth saving is on the clipboard (not still being read, not blank).
  const clip = c.phase === "empty" || c.phase === "loading" ? null : c.clip;
  const { save, openInEditor, hide } = c;
  // No menu while the footer shows an error: it would open under it, and pop up after retry.
  const menuable = !!clip && c.phase !== "error";
  const toggleActions = useCallback(() => {
    if (menuable) setActionsOpen((o) => !o);
  }, [menuable]);
  // `#` and `@` from the sheet itself: straight to the field, without the Tab walk past
  // every image chip and the source picker.
  const jump = useCallback(
    (field: "tags" | "project") =>
      fit.current
        ?.querySelector<HTMLInputElement>(
          `input[aria-label="${field === "tags" ? "Tags" : "Project"}"]`,
        )
        ?.focus(),
    [fit],
  );
  useCaptureKeys({
    onSave: (reveal) => fire(save(reveal)),
    onOpenEditor: openInEditor,
    onActions: toggleActions,
    onHide: hide,
    onPickProject: c.pickProject,
    onJump: jump,
  });
  const titleId = useId();
  // Each show lands focus on the sheet itself — not a field, so a stray keystroke doesn't
  // end up in an input — and screen readers announce the dialog. The keys above still work.
  useEffect(
    () =>
      on("capture:shown", () => {
        setActionsOpen(false);
        fit.current?.focus();
      }),
    [fit],
  );

  const saveLabel = c.assets.stranded > 0 ? "Save anyway" : c.hasRemote ? "Save & commit" : "Save";
  const actions: CaptureAction[] = [
    {
      id: "save",
      label: saveLabel,
      keys: `${MOD_KEY}↵`,
      disabled: c.phase !== "ready" && c.phase !== "error",
      run: () => fire(save(false)),
    },
    {
      id: "save-open",
      label: "Save and open in Marasca",
      keys: `${ALT_KEY}${MOD_KEY}↵`,
      disabled: c.phase !== "ready" && c.phase !== "error",
      run: () => fire(save(true)),
    },
    { id: "editor", label: "Open in editor", keys: `${MOD_KEY}E`, run: openInEditor },
    { id: "discard", label: "Discard", keys: "esc", danger: true, run: hide },
  ];

  return (
    <div
      ref={fit}
      role="dialog"
      aria-modal="true"
      aria-label="Capture from clipboard"
      tabIndex={-1}
      className="dark flex flex-col rounded-lg border border-overlay-line bg-overlay text-overlay-ink outline-none"
    >
      <div className="flex items-center gap-2 px-5 pt-5 pb-4 text-base">
        <ArrowDownToLine size={14} className="shrink-0 text-overlay-ink-3" />
        {clip ? (
          <>
            {/* The title the document is saved under, guessed from the clip and yours to
                change: the sheet used to save whatever the first heading said. */}
            <label htmlFor={titleId} className="sr-only">
              Title
            </label>
            <input
              id={titleId}
              value={c.form.title}
              placeholder={c.title || "Untitled"}
              onChange={(e) => c.setTitle(e.target.value)}
              spellCheck={false}
              className="-mx-1 h-7 min-w-0 flex-1 rounded-xs bg-transparent px-1 font-medium text-overlay-ink transition-colors outline-none placeholder:text-overlay-ink-3 hover:bg-overlay-2 focus:bg-overlay-2"
            />
            {/* An image has no words to count; its size is under the preview. */}
            {!clip.image && (
              <span className="shrink-0 font-mono text-xs text-overlay-ink-3">
                {plural(countWords(c.text), "word")} ·{" "}
                {plural(c.text.split(/\r?\n/).length, "line")}
              </span>
            )}
          </>
        ) : (
          <span className="font-medium">Capture from clipboard</span>
        )}
      </div>

      {c.phase === "loading" ? (
        // Quiet until the clipboard is read: "Clipboard is empty" (or the last save) used
        // to flash here for a frame on every show.
        <div role="status" aria-label="Reading the clipboard" className="py-16" />
      ) : clip ? (
        <>
          <div className="px-5">
            <CapturePreview
              clip={clip}
              text={c.text}
              variant={c.form.variant}
              onVariant={c.setVariant}
              compact={c.assets.refs.length > 0}
            />
            <AssetPanel
              plan={c.assets}
              dark
              baseLabel={clip.image ? "on the clipboard" : undefined}
              className="mt-3"
            />
            <div className="mt-4">
              <CaptureFields
                form={c.form}
                onChange={c.setForm}
                projects={c.projects}
                tags={c.tags}
                lastProject={c.lastProject}
                // "manual" is what's left when nothing was recognised, not a detection.
                detected={clip.detectedSource !== "manual" && c.form.source === clip.detectedSource}
                shortcuts={c.recents}
                suggestedTags={c.suggestedTags}
                onAddTag={c.addTag}
              />
            </div>
          </div>
          <div className="mt-5">
            <CaptureFooter
              pathPreview={c.pathPreview}
              project={c.form.project}
              phase={c.phase}
              error={c.error}
              savedPath={c.savedPath}
              saveLabel={saveLabel}
              actions={actions}
              actionsOpen={actionsOpen}
              onActionsOpenChange={setActionsOpen}
              onSave={(reveal) => fire(save(reveal))}
              onRetry={c.retry}
            />
          </div>
        </>
      ) : (
        <div className="px-5 pb-5">
          <CaptureEmpty onOpenEditor={c.openInEditor} />
        </div>
      )}
    </div>
  );
}
