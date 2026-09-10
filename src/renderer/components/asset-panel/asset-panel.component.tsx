import { FolderOpen, Image } from "lucide-react";
import { ASSET_WARN_BYTES } from "@shared/constants";
import { Button, Chip } from "@/components/ui";
import { cx, formatBytes, plural, shortPath } from "@/helpers";
import type { AssetPanelProps } from "./asset-panel.types";

/**
 * "3 images · 2 found in ~/Coding/concorde · 1 missing" with a folder picker and a row
 * per file. Rendered only when the body references relative images.
 */
export function AssetPanel({ plan, dark, className }: AssetPanelProps) {
  if (!plan.refs.length) return null;
  const muted = dark ? "text-overlay-ink-3" : "text-ink-4";
  const strong = dark ? "text-overlay-ink" : "text-ink";
  return (
    <div
      className={cx(
        "rounded-md border px-3 py-2 text-xs",
        dark ? "border-overlay-line bg-black/20" : "border-line bg-paper-2",
        className,
      )}
      data-testid="asset-panel"
    >
      <div className="flex items-center gap-2">
        <Image size={13} className={muted} />
        <span className={cx("font-medium", strong)}>
          {plural(plan.refs.length, "image")} referenced
        </span>
        <span className={muted}>
          {plan.baseDir ? (
            <>
              {plan.found} found in <span className="font-mono">{shortPath(plan.baseDir)}</span>
              {plan.missing > 0 && ` · ${plan.missing} missing`}
            </>
          ) : (
            "relative paths — choose the folder they live in"
          )}
        </span>
        <Button
          variant={dark ? "ghost" : "outline"}
          size="sm"
          className={cx("ml-auto", dark && "text-overlay-ink-2 hover:bg-overlay-3")}
          onClick={() => void plan.chooseFolder()}
        >
          <FolderOpen size={11} /> {plan.baseDir ? "Change folder" : "Choose folder…"}
        </Button>
      </div>
      <ul className="mt-1.5 max-h-20 space-y-0.5 overflow-y-auto">
        {plan.refs.map((r) => {
          const off = plan.excluded.includes(r.ref);
          const big = r.bytes > ASSET_WARN_BYTES;
          return (
            <li key={r.ref} className="flex items-center gap-2 font-mono">
              <span
                className={cx("min-w-0 flex-1 truncate", r.status === "found" ? strong : muted)}
              >
                {r.ref}
              </span>
              {r.status === "found" ? (
                <>
                  <span className={big ? "text-warn" : muted}>
                    {formatBytes(r.bytes)}
                    {big && " · large — this goes into git for good"}
                  </span>
                  <Chip tone="neutral" selected={!off} onClick={() => plan.toggle(r.ref)}>
                    {off ? "skip" : "copy"}
                  </Chip>
                </>
              ) : (
                <span className={r.status === "missing" ? "text-cherry-3" : muted}>
                  {r.status === "missing"
                    ? "not found"
                    : r.status === "unsupported"
                      ? "unsupported type"
                      : "—"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {plan.bytes > 0 && (
        <div className={cx("mt-1", muted)}>
          {formatBytes(plan.bytes)} will be committed next to the doc as{" "}
          <span className="font-mono">assets/</span>
        </div>
      )}
    </div>
  );
}
