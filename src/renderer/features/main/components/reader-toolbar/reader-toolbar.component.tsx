import { ExternalLink, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { READER_VIEWS } from "@/data/main.data";
import { cx, readTime } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { ReaderToolbarProps } from "./reader-toolbar.types";

export function ReaderToolbar({
  doc,
  view,
  onView,
  onStar,
  onTrash,
  trashed,
  onRestore,
  onPurge,
}: ReaderToolbarProps) {
  const remote = useApp((s) => s.config?.remote);
  const branch = useApp((s) => s.config?.branch ?? "main");
  if (!doc) return <div className="h-11 shrink-0" />;
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-4">
      <div className="flex items-center gap-3">
        {/* gap-0.5 matches the sidebar rows, so an active tab never touches a hovered one. */}
        <div className="flex gap-0.5 rounded-sm bg-paper-2 p-0.5">
          {READER_VIEWS.map((v) => (
            <Button
              key={v.key}
              variant="ghost"
              size="sm"
              className={cx("h-6 px-2", view === v.key && "bg-paper text-ink shadow-pop")}
              onClick={() => onView(v.key)}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-ink-4">{readTime(doc.words)}</span>
      </div>
      {trashed ? (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onRestore}>
            <RotateCcw size={11} /> Restore
          </Button>
          <Button variant="danger" size="sm" onClick={onPurge} title="Delete forever">
            <Trash2 size={11} /> Delete forever
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onStar}
            title={doc.starred ? "Unstar" : "Star"}
            aria-label="star"
          >
            <Star size={12} className={cx(doc.starred && "fill-warn text-warn")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => api("window:openEditor", doc.path)}>
            <Pencil size={11} /> Edit
          </Button>
          {remote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => api("github:openInBrowser", `${remote}/blob/${branch}/${doc.path}`)}
              title="Open on GitHub"
            >
              <ExternalLink size={11} /> GitHub
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onTrash}
            title={`Move to trash (${MOD_KEY}⌫)`}
            aria-label="move to trash"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      )}
    </div>
  );
}
