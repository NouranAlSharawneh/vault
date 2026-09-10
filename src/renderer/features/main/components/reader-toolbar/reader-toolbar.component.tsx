import { ExternalLink, Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui";
import { READER_VIEWS } from "@/data/main.data";
import { cx, readTime } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { ReaderToolbarProps } from "./reader-toolbar.types";

export function ReaderToolbar({ doc, view, onView, onStar }: ReaderToolbarProps) {
  const remote = useApp((s) => s.config?.remote);
  const branch = useApp((s) => s.config?.branch ?? "main");
  if (!doc) return <div className="h-11 shrink-0" />;
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex rounded-sm bg-paper-2 p-0.5">
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
      </div>
    </div>
  );
}
