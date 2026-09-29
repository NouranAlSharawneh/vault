import { BookOpen, Code, Columns2, History, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import { Button, GitHubMark, Segmented } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { READER_VIEWS } from "@/data/main.data";
import { cx, readTime } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { ReaderToolbarProps } from "./reader-toolbar.types";

const VIEW_ICON = { preview: BookOpen, markdown: Code, split: Columns2 } as const;

/** With the history drawer open the reader is narrow: the views become their icons. */
const VIEW_OPTIONS = READER_VIEWS.map((v) => {
  const Icon = VIEW_ICON[v.key];

  return { value: v.key, label: v.label, icon: <Icon size={14} /> };
});

export function ReaderToolbar({
  doc,
  view,
  onView,
  onStar,
  onTrash,
  onHistory,
  historyOpen,
  trashed,
  onRestore,
  onPurge,
  trashBusy,
}: ReaderToolbarProps) {
  const remote = useApp((s) => s.config?.remote);
  const branch = useApp((s) => s.config?.branch ?? "main");
  if (!doc) return <div className="h-11 shrink-0" />;

  return (
    // A container: the reading time gives way when the reader is narrow, instead of the
    // actions being pushed off its edge.
    <div className="@container flex h-11 shrink-0 items-center justify-between gap-3 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Segmented
          label="Reader view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={onView}
          compact
        />
        <span className="hidden text-xs whitespace-nowrap text-ink-4 @lg:inline">
          {readTime(doc.words)}
        </span>
      </div>
      {trashed ? (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={!!trashBusy}
            loading={trashBusy === "restore"}
            onClick={onRestore}
          >
            <RotateCcw size={12} /> Restore
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!!trashBusy}
            loading={trashBusy === "purge"}
            onClick={onPurge}
            tooltip="Permanently, everywhere"
          >
            <Trash2 size={12} /> Delete forever
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onStar}
            tooltip={doc.starred ? "Unstar" : "Star"}
            aria-label={doc.starred ? "Unstar" : "Star"}
            aria-pressed={!!doc.starred}
          >
            <Star size={14} className={cx(doc.starred && "fill-warn-2 text-warn-2")} />
          </Button>
          {/* Icons only: with the history drawer open the reader is narrow, and labelled
              buttons ran into each other. Every one names itself on hover instead. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fire(api("window:openEditor", doc.path), "Couldn’t open the editor")}
            tooltip="Edit"
            aria-label="edit"
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cx(historyOpen && "bg-paper-3 text-ink")}
            onClick={onHistory}
            tooltip="History"
            tooltipKeys={`${MOD_KEY}Y`}
            aria-label="history"
            aria-pressed={historyOpen}
          >
            <History size={14} />
          </Button>
          {remote && (
            <Button
              variant="ghost"
              size="icon"
              // A document not pushed yet is a 404 on GitHub; say so instead of opening one.
              disabled={!!doc.unpushed}
              onClick={() =>
                fire(
                  api(
                    "github:openInBrowser",
                    `${remote}/blob/${encodeURIComponent(branch)}/${doc.path
                      .split("/")
                      .map(encodeURIComponent)
                      .join("/")}`,
                  ),
                  "Couldn’t open GitHub",
                )
              }
              tooltip={
                doc.unpushed
                  ? "Not on GitHub yet — it goes up with the next push"
                  : "Open on GitHub"
              }
              aria-label="Open on GitHub"
            >
              {/* The mark says where the link goes, and matches the sidebar's repo link. */}
              <GitHubMark size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={!!trashBusy}
            loading={trashBusy === "trash"}
            onClick={onTrash}
            tooltip="Move to trash"
            tooltipKeys={`${MOD_KEY}⌫`}
            tooltipAlign="end"
            aria-label="move to trash"
          >
            {/* The spinner takes the icon's place: there is no room here for both. */}
            {trashBusy !== "trash" && <Trash2 size={14} />}
          </Button>
        </div>
      )}
    </div>
  );
}
