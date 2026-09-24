import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui";
import { cx } from "@/helpers";
import type { CaptureActionsProps } from "./capture-actions.types";

/**
 * Everything the sheet can do, with its shortcut, in one list above the action bar.
 * The bar only ever shows the save button and this menu's trigger; new actions go here.
 */
export function CaptureActions({ actions, onClose }: CaptureActionsProps) {
  const enabled = actions.filter((a) => !a.disabled);
  const [cursor, setCursor] = useState(0);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => items.current[cursor]?.focus(), [cursor]);
  // A click anywhere else in the sheet closes it. The trigger toggles on its own.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!menu.current?.contains(t) && !t.closest?.('[aria-haspopup="menu"]')) onClose();
    };
    document.addEventListener("pointerdown", onDown);

    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setCursor((c) => (c + step + enabled.length) % enabled.length);
    } else if (e.key === "Escape" || e.key === "Tab") {
      // Escape closes the menu, not the whole sheet: the sheet's own key handler skips
      // a prevented Escape.
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={menu}
      role="menu"
      aria-label="Actions"
      onKeyDown={onKeyDown}
      className="absolute right-2 bottom-full z-20 mb-2 w-72 animate-pop-in rounded-md border border-overlay-line bg-overlay-2 p-1 shadow-pop"
    >
      {actions.map((a, i) => {
        const at = enabled.indexOf(a);

        return (
          <div key={a.id}>
            {a.danger && i > 0 && (
              <div role="separator" className="mx-1 my-1 h-px bg-overlay-line" />
            )}
            <button
              type="button"
              role="menuitem"
              ref={(el) => {
                if (at >= 0) items.current[at] = el;
              }}
              tabIndex={at === cursor ? 0 : -1}
              disabled={a.disabled}
              onMouseEnter={() => at >= 0 && setCursor(at)}
              onClick={() => {
                onClose();
                a.run();
              }}
              className={cx(
                "flex h-8 w-full items-center gap-2 rounded-xs px-2 text-left text-sm outline-none",
                a.danger ? "text-cherry-3" : "text-overlay-ink",
                at === cursor && "bg-overlay-3",
                a.disabled && "opacity-40",
              )}
            >
              {a.label}
              <span className="ml-auto">
                <Kbd dark>{a.keys}</Kbd>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
