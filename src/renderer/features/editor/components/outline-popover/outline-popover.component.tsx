import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { DialogHeader, DialogShell, ListRow } from "@/components/ui";
import type { OutlinePopoverProps } from "./outline-popover.types";

/**
 * ⇧⌘O: the document's headings, filtered as you type; ↑/↓ and Enter jump to one. A long
 * document had no way to get to a section but scrolling.
 */
export function OutlinePopover({ headings, onJump, onClose }: OutlinePopoverProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listId = useId();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();

    return q ? headings.filter((h) => h.text.toLowerCase().includes(q)) : headings;
  }, [headings, query]);
  const at = Math.min(cursor, Math.max(shown.length - 1, 0));
  const top = Math.min(...headings.map((h) => h.level));

  const jump = (line: number) => {
    onClose();
    onJump(line);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      setCursor((at + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing && shown[at]) {
      e.preventDefault();
      jump(shown[at].line);
    }
  };

  return (
    <DialogShell
      label="Jump to a heading"
      onClose={onClose}
      // Straight into the filter: it is what you came to type in.
      initialFocus='input[aria-label="Filter headings"]'
      className="flex max-h-full w-110 max-w-full animate-pop-in flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sheet"
    >
      <DialogHeader title="Outline" closeLabel="close outline" onClose={onClose} />
      <div className="px-4 pb-2">
        <input
          className="input"
          placeholder="Filter headings…"
          aria-label="Filter headings"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-activedescendant={shown.length ? `${listId}-${at}` : undefined}
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Headings"
        className="max-h-80 overflow-y-auto px-2 pb-2"
      >
        {shown.length === 0 && (
          <div className="px-2 py-3 text-sm text-ink-4">
            {headings.length ? "No heading matches." : "This document has no headings yet."}
          </div>
        )}
        {shown.map((h, i) => (
          <ListRow
            key={h.line}
            id={`${listId}-${i}`}
            kind="menu"
            selected={i === at}
            onMouseEnter={() => setCursor(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => jump(h.line)}
          >
            {/* Indented by level, relative to the document's own top level. */}
            <span className="truncate" style={{ paddingLeft: `${(h.level - top) * 12}px` }}>
              {h.text}
            </span>
            <span className="ml-auto shrink-0 font-mono text-2xs text-ink-4">{h.line}</span>
          </ListRow>
        ))}
      </div>
    </DialogShell>
  );
}
