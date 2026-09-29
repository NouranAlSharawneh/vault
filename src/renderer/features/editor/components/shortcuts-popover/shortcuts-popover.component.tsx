import { DialogHeader, DialogShell, Kbd } from "@/components/ui";
import { ALT_KEY, MOD_KEY } from "@/constants";
import { editorShortcuts } from "@/data/editor.data";
import type { ShortcutsPopoverProps } from "./shortcuts-popover.types";

/** The editor's "?": every key it answers to, in one list. */
export function ShortcutsPopover({ onClose }: ShortcutsPopoverProps) {
  return (
    <DialogShell
      label="Keyboard shortcuts"
      onClose={onClose}
      // The list, not the close button, whose tooltip would sit over the first key.
      initialFocus="[data-shortcut-list]"
      className="flex max-h-full w-100 max-w-full animate-pop-in flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sheet"
    >
      <DialogHeader title="Keyboard shortcuts" closeLabel="close shortcuts" onClose={onClose} />
      <dl
        data-shortcut-list
        tabIndex={-1}
        className="grid grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto px-4 pb-4 text-sm outline-none"
      >
        {editorShortcuts(MOD_KEY, ALT_KEY).map((s) => (
          <div key={s.keys} className="contents">
            <dt className="text-ink-2">{s.does}</dt>
            <dd className="justify-self-end">
              <Kbd>{s.keys}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
    </DialogShell>
  );
}
