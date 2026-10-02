import { useEffect, useRef } from "react";
import { ListRow } from "@/components/ui";
import { cx } from "@/helpers";
import type { DocumentOutlineProps, OutlineHeading } from "./document-outline.types";

const INDENT: Record<OutlineHeading["level"], string> = { 1: "", 2: "pl-5", 3: "pl-8" };

/**
 * The document's sections, to jump to one: a long runbook was a scroll and a squint to get
 * around. Opens on the first heading; ↑/↓ move, Enter jumps, Esc or a click away closes.
 */
export function DocumentOutline({ headings, onPick, onClose }: DocumentOutlineProps) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!panel.current?.contains(t) && !t.closest?.("[data-outline-toggle]")) onClose();
    };
    document.addEventListener("pointerdown", away);

    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();

      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const rows = [...(panel.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const at = rows.indexOf(document.activeElement as HTMLElement);
    rows[(at + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length]?.focus();
  };

  return (
    <nav
      ref={panel}
      aria-label="Outline"
      onKeyDown={onKeyDown}
      className="absolute top-11 right-4 z-20 max-h-80 w-72 animate-fade-in overflow-y-auto rounded-md border border-line bg-paper p-1 shadow-pop"
    >
      {headings.length ? (
        headings.map((h) => (
          <ListRow
            key={h.id}
            className={cx("truncate", INDENT[h.level], h.level === 1 && "font-medium")}
            onClick={() => onPick(h.id)}
          >
            <span className="truncate">{h.text}</span>
          </ListRow>
        ))
      ) : (
        <div className="px-2 py-1.5 text-xs text-ink-4">This document has no headings.</div>
      )}
    </nav>
  );
}
