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

/** ⌃⌥V sheet: clipboard → two tabs → ⌘↵. The main window never opens. */
export function Capture() {
  const c = useCapture();
  const fit = useFitWindow<HTMLDivElement>();
  useCaptureKeys({
    onSave: () => fire(c.save()),
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
              onSave={() => fire(c.save())}
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
