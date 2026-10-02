import { Fragment, useEffect, useState } from "react";
import { DialogHeader, DialogShell, Kbd, SectionLabel } from "@/components/ui";
import { errorMessage, shortcutKeys } from "@/helpers";
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
      className="flex max-h-full w-170 max-w-full animate-pop-in flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sheet"
    >
      <DialogHeader
        className="border-b border-line px-5"
        title="Keyboard shortcuts"
        closeLabel="close keyboard shortcuts"
        onClose={onClose}
      />
      <div className="min-h-0 overflow-y-auto px-5 pt-5 pb-6">
        {error ? (
          <p role="alert" className="text-sm text-cherry">
            {error}
          </p>
        ) : !groups ? (
          <p className="text-sm text-ink-4">Reading the menus…</p>
        ) : (
          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {splitColumns(groups).map((column, c) => (
              <div key={c} className="flex flex-col gap-7">
                {column.map((g) => (
                  <Group key={g.title} group={g} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function Group({ group }: { group: ShortcutGroup }) {
  const id = `shortcuts-${group.title}`;

  return (
    <section aria-labelledby={id}>
      <SectionLabel as="h3" id={id} className="mb-1">
        {group.title}
      </SectionLabel>
      <dl>
        {group.items.map((i) => (
          <div
            key={`${i.label}-${i.accelerator}`}
            className="flex min-h-9 items-center justify-between gap-4 border-b border-line py-1.5 text-sm text-ink-2 last:border-b-0"
          >
            <dt className="min-w-0">{i.label}</dt>
            <dd className="flex shrink-0 items-center">
              <Keys accelerator={i.accelerator} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One cap per key, a quiet slash between keys that do the same job: ⌘ B, ↑ / ↓. */
function Keys({ accelerator }: { accelerator: string }) {
  return shortcutKeys(accelerator).map((combo, n) => (
    <Fragment key={n}>
      {n > 0 && (
        <span aria-hidden className="mx-1.5 text-xs text-ink-4">
          /
        </span>
      )}
      <span className="flex items-center gap-1">
        {combo.map((k, m) => (
          <Kbd key={m} className="inline-flex min-w-5.5 justify-center">
            {k}
          </Kbd>
        ))}
      </span>
    </Fragment>
  ));
}

/**
 * Two columns with no hole in either: the groups stay in menu order, broken where the two
 * sides come closest to the same height. A heading counts as two rows, its space included.
 */
function splitColumns(groups: ShortcutGroup[]): ShortcutGroup[][] {
  const weight = (gs: ShortcutGroup[]) => gs.reduce((n, g) => n + g.items.length + 2, 0);
  let best = 1;
  for (let at = 1; at < groups.length; at++) {
    const diff = Math.abs(weight(groups.slice(0, at)) - weight(groups.slice(at)));
    if (diff < Math.abs(weight(groups.slice(0, best)) - weight(groups.slice(best)))) best = at;
  }

  return [groups.slice(0, best), groups.slice(best)].filter((c) => c.length > 0);
}
