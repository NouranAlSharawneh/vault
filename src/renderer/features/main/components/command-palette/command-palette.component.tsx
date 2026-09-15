import { useEffect, useMemo, useRef } from "react";
import {
  ChevronRight,
  Download,
  FileText,
  GitMerge,
  Pilcrow,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { PaletteActionKey } from "@/data/palette.data";
import { relativeTime } from "@shared/helpers";
import { Chip, DialogShell, Kbd, ListRow } from "@/components/ui";
import { PALETTE_HINTS } from "@/data/palette.data";
import { useCommandPalette } from "./hooks/use-command-palette.hook";
import type { CommandPaletteProps, PaletteItem } from "./command-palette.types";

const ACTION_ICONS: Record<PaletteActionKey, LucideIcon> = {
  newFromClipboard: Plus,
  newDocument: FileText,
  trashDoc: Trash2,
  pushPending: Upload,
  pullNow: Download,
  reviewConflicts: GitMerge,
  rescan: RefreshCw,
  settings: Settings,
};

function itemKey(item: PaletteItem): string {
  return item.kind === "action" ? `action:${item.key}` : `${item.kind}:${item.doc.path}`;
}

/** ⌘K — the primary navigation surface: grouped results with a live preview. */
export function CommandPalette({
  onClose,
  onOpenDoc,
  onTrashDoc,
  onReviewConflicts,
}: CommandPaletteProps) {
  const p = useCommandPalette(onOpenDoc, onClose, onTrashDoc, onReviewConflicts);
  const input = useRef<HTMLInputElement>(null);

  // Arrows and Enter are the palette's whole interaction, and they used to live on the
  // input alone — so clicking a group heading or the preview blurred it and the palette
  // went keyboard-dead with no way to close it but the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        p.onKeyDown(e);
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  const activeDoc = p.active && p.active.kind !== "action" ? p.active.doc : null;
  // Flat index of each group's first item, so rows know their position in the keyboard order.
  const starts = useMemo(
    () =>
      p.groups.reduce<number[]>(
        (acc, _g, i) => [...acc, (acc[i - 1] ?? 0) + (p.groups[i - 1]?.items.length ?? 0)],
        [],
      ),
    [p.groups],
  );

  return (
    <DialogShell
      label="Search"
      onClose={onClose}
      backdropClassName="items-start bg-ink/25 pt-20"
      className="dark flex h-105 w-165 max-w-[94vw] animate-pop-in flex-col overflow-hidden rounded-lg bg-overlay text-overlay-ink shadow-sheet"
      initialFocus='input[aria-label="search"]'
    >
      <div className="flex items-center gap-2 border-b border-overlay-line px-4">
        <ChevronRight size={14} className="text-overlay-ink-3" />
        <input
          ref={input}
          className="h-12 flex-1 bg-transparent text-lg text-overlay-ink outline-none placeholder:text-overlay-ink-3"
          placeholder="Search titles, tags and text…"
          value={p.query}
          onChange={(e) => p.setQuery(e.target.value)}
          onKeyDown={p.onKeyDown}
          aria-label="search"
          spellCheck={false}
        />
        <Kbd dark>esc</Kbd>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr]">
        <div className="min-h-0 overflow-y-auto py-2">
          {p.groups.length === 0 && (
            <div className="px-4 py-6 text-sm text-overlay-ink-3">
              No matches. Try an operator:{" "}
              {PALETTE_HINTS.map((h) => (
                <code key={h} className="mr-1 text-overlay-ink-2">
                  {h}
                </code>
              ))}
            </div>
          )}
          {p.groups.map((g, gi) => (
            <div key={g.title}>
              <div className="px-4 pt-2 pb-1 text-2xs font-semibold tracking-widest text-overlay-ink-3 uppercase">
                {g.title}
              </div>
              {g.items.map((item, ii) => {
                const i = starts[gi] + ii;
                const selected = i === p.cursor;
                const Icon =
                  item.kind === "action"
                    ? ACTION_ICONS[item.key]
                    : item.kind === "text"
                      ? Pilcrow
                      : FileText;
                return (
                  <ListRow
                    kind="palette"
                    key={itemKey(item)}
                    selected={selected}
                    onMouseEnter={() => p.setCursor(i)}
                    onClick={() => p.choose(item)}
                  >
                    <Icon size={13} className="mt-0.5 shrink-0 text-overlay-ink-3" />
                    <span className="min-w-0 flex-1">
                      {item.kind === "action" ? (
                        <span className="text-base">{item.label}</span>
                      ) : item.kind === "text" ? (
                        <>
                          <span className="line-clamp-1 text-sm text-overlay-ink-2">
                            {item.snippet}
                          </span>
                          <span className="text-xs text-overlay-ink-3">{item.doc.title}</span>
                        </>
                      ) : (
                        <>
                          <span className="line-clamp-1 text-base">{item.doc.title}</span>
                          <span className="text-xs text-overlay-ink-3">
                            {item.doc.project || "Inbox"}
                            {item.doc.tags.length
                              ? " · " + item.doc.tags.map((t) => "#" + t).join(" ")
                              : ""}{" "}
                            · {relativeTime(item.doc.created)}
                          </span>
                        </>
                      )}
                    </span>
                    {item.kind === "action" && item.shortcut && <Kbd dark>{item.shortcut}</Kbd>}
                    {selected && item.kind !== "action" && (
                      <span className="text-overlay-ink-3">↵</span>
                    )}
                  </ListRow>
                );
              })}
            </div>
          ))}
        </div>
        <div className="min-h-0 overflow-y-auto border-l border-overlay-line p-4">
          {activeDoc ? (
            <>
              <div className="font-serif text-lg text-overlay-ink">{activeDoc.title}</div>
              <p className="mt-2 font-serif text-md text-overlay-ink-2">
                {activeDoc.excerpt || "—"}
              </p>
              {activeDoc.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {activeDoc.tags.map((t) => (
                    <Chip key={t}>#{t}</Chip>
                  ))}
                </div>
              )}
              <div className="mt-6 font-mono text-2xs text-overlay-ink-3">{activeDoc.path}</div>
            </>
          ) : (
            <div className="text-sm text-overlay-ink-3">
              <div className="mb-2 text-2xs font-semibold tracking-widest uppercase">Grammar</div>
              <code className="block">project:"Atlas API"</code>
              <code className="block">tags:spec · tags:empty</code>
              <code className="block">created:&gt;30d</code>
              <code className="block">source:claude</code>
              <code className="block">is:starred · is:unpushed · is:orphan</code>
              <code className="block">p: t: tag: from: — short for the above</code>
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
