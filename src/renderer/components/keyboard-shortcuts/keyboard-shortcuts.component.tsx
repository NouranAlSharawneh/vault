import { useEffect, useState } from "react";
import { DialogHeader, DialogShell, Kbd, SectionLabel } from "@/components/ui";
import { errorMessage, shortcutLabel } from "@/helpers";
import { api, on } from "@/lib/api";
import { useShortcutsSheet } from "@/stores/shortcuts";
import type { ShortcutGroup } from "@shared/types";

/**
 * Help ▸ Keyboard Shortcuts (⌘/). Built from the menus main already has, so it lists the
 * capture shortcut as it is now, not as it shipped — plus the keys that work inside a
 * window and have no menu item to show them.
 */
export function KeyboardShortcuts() {
  const open = useShortcutsSheet((s) => s.open);
  const setOpen = useShortcutsSheet((s) => s.setOpen);

  // The menu item and ⌘/ both ask. From the menu this arrives on the shortcut channel;
  // the keydown is for a window whose menu isn't the one being used.
  useEffect(() => {
    const off = on("shortcut", (s) => s === "shortcuts" && setOpen(true));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      off();
      window.removeEventListener("keydown", onKey);
    };
  }, [setOpen]);

  return open ? <Sheet onClose={() => setOpen(false)} /> : null;
}

function Sheet({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<ShortcutGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api("app:shortcuts")
      .then((g) => live && setGroups(g))
      .catch((e: unknown) => live && setError(errorMessage(e)));

    return () => {
      live = false;
    };
  }, []);

  return (
    <DialogShell
      label="Keyboard shortcuts"
      onClose={onClose}
      className="flex max-h-full w-150 max-w-full animate-pop-in flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sheet"
    >
      <DialogHeader
        className="border-b border-line"
        title="Keyboard shortcuts"
        closeLabel="close keyboard shortcuts"
        onClose={onClose}
      />
      <div className="min-h-0 overflow-y-auto px-4 pt-3 pb-5">
        {error ? (
          <p role="alert" className="text-sm text-cherry">
            {error}
          </p>
        ) : !groups ? (
          <p className="text-sm text-ink-4">Reading the menus…</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {groups.map((g) => (
              <section key={g.title} aria-labelledby={`shortcuts-${g.title}`}>
                <SectionLabel as="h3" id={`shortcuts-${g.title}`} className="mb-1.5">
                  {g.title}
                </SectionLabel>
                <dl className="flex flex-col gap-1">
                  {g.items.map((i) => (
                    <div
                      key={`${i.label}-${i.accelerator}`}
                      className="flex items-center justify-between gap-3 text-sm text-ink-2"
                    >
                      <dt className="min-w-0 truncate">{i.label}</dt>
                      <dd className="shrink-0">
                        <Kbd>{shortcutLabel(i.accelerator)}</Kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  );
}
