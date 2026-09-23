import { ArrowDownToLine } from "lucide-react";
import { AssetPanel } from "@/components/asset-panel";
import { Kbd } from "@/components/ui";
import { plural } from "@/helpers";
import { fire } from "@/lib/api";
import { CaptureEmpty } from "./components/capture-empty/capture-empty.component";
import { CaptureFields } from "./components/capture-fields/capture-fields.component";
import { CaptureFooter } from "./components/capture-footer/capture-footer.component";
import { CapturePreview } from "./components/capture-preview/capture-preview.component";
import { useCaptureKeys } from "./hooks/use-capture-keys.hook";
import { useCapture } from "./hooks/use-capture.hook";
import { useFitWindow } from "./hooks/use-fit-window.hook";

/**
 * ⌃⌥V sheet: clipboard → two tabs → ⌘↵, and you are back in the app you copied from.
 * The main window opens only when asked for, with ⌥⌘↵.
 */
export function Capture() {
  const c = useCapture();
  const fit = useFitWindow<HTMLDivElement>();
  // Something worth saving is on the clipboard (not still being read, not blank).
  const clip = c.phase === "empty" || c.phase === "loading" ? null : c.clip;
  useCaptureKeys({
    onSave: (reveal) => fire(c.save(reveal)),
    onOpenEditor: c.openInEditor,
    onHide: c.hide,
  });

  return (
    <div
      ref={fit}
      className="dark flex flex-col rounded-lg border border-overlay-line bg-overlay/95 p-5 text-overlay-ink shadow-sheet backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-base">
          <ArrowDownToLine size={14} className="text-overlay-ink-3" />
          <span className="font-medium">Capture from clipboard</span>
          {clip && (
            <span className="font-mono text-xs text-overlay-ink-3">
              {plural(clip.words, "word")} detected
            </span>
          )}
        </div>
        <Kbd dark>esc</Kbd>
      </div>

      {c.phase === "loading" ? (
        // Quiet until the clipboard is read: "Clipboard is empty" (or the last save) used
        // to flash here for a frame on every show.
        <div role="status" aria-label="Reading the clipboard" className="py-16" />
      ) : clip ? (
        <>
          <CapturePreview clip={clip} compact={c.assets.refs.length > 0} />
          <AssetPanel plan={c.assets} dark className="mt-3" />
          <div className="mt-4">
            <CaptureFields
              form={c.form}
              onChange={c.setForm}
              projects={c.projects}
              tags={c.tags}
              lastProject={c.lastProject}
              detected={c.form.source === clip.detectedSource}
            />
          </div>
          <div className="mt-4">
            <CaptureFooter
              pathPreview={c.pathPreview}
              phase={c.phase}
              error={c.error}
              savedPath={c.savedPath}
              hasRemote={c.hasRemote}
              stranded={c.assets.stranded}
              onOpenEditor={c.openInEditor}
              onSave={(reveal) => fire(c.save(reveal))}
              onRetry={c.retry}
            />
          </div>
        </>
      ) : (
        <CaptureEmpty onOpenEditor={c.openInEditor} />
      )}
    </div>
  );
}
