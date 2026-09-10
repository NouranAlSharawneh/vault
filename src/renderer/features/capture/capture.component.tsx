import { ArrowDownToLine } from "lucide-react";
import { AssetPanel } from "@/components/asset-panel";
import { Kbd } from "@/components/ui";
import { plural } from "@/helpers";
import { useCapture } from "./hooks/use-capture.hook";
import { useCaptureKeys } from "./hooks/use-capture-keys.hook";
import { CapturePreview } from "./components/capture-preview/capture-preview.component";
import { CaptureFields } from "./components/capture-fields/capture-fields.component";
import { CaptureFooter } from "./components/capture-footer/capture-footer.component";
import { CaptureEmpty } from "./components/capture-empty/capture-empty.component";

/** ⌃⌥V sheet: clipboard → two tabs → ⌘↵. The main window never opens. */
export function Capture() {
  const c = useCapture();
  useCaptureKeys({ onSave: () => void c.save(), onOpenEditor: c.openInEditor, onHide: c.hide });

  return (
    <div className="dark flex h-full flex-col rounded-lg border border-overlay-line bg-overlay/95 p-5 text-overlay-ink shadow-sheet backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-base">
          <ArrowDownToLine size={14} className="text-overlay-ink-3" />
          <span className="font-medium">Capture from clipboard</span>
          {c.clip && c.phase !== "empty" && (
            <span className="font-mono text-xs text-overlay-ink-3">
              {plural(c.clip.words, "word")} detected
            </span>
          )}
        </div>
        <Kbd dark>esc</Kbd>
      </div>

      {c.clip && c.phase !== "empty" ? (
        <>
          <CapturePreview clip={c.clip} compact={c.assets.refs.length > 0} />
          <AssetPanel plan={c.assets} dark className="mt-3" />
          <div className="mt-4">
            <CaptureFields
              form={c.form}
              onChange={c.setForm}
              projects={c.projects}
              tags={c.tags}
              lastProject={c.lastProject}
              detected={c.form.source === c.clip.detectedSource}
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
              onSave={() => void c.save()}
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
