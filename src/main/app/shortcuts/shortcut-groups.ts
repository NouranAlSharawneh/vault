import type { ShortcutGroup } from "@shared/types";
import type { MenuSectionData } from "../menu/menu.types";

/**
 * Keys that live in the windows rather than the menus. Written down here because nothing
 * else declares them, and a sheet of shortcuts without the list's arrows or the editor's
 * find would be missing the ones used most. " / " separates keys that do the same job.
 */
const IN_WINDOW: ShortcutGroup[] = [
  {
    title: "Library",
    items: [
      { label: "Move through the list", accelerator: "Up / Down" },
      { label: "First or last document", accelerator: "Home / End" },
      { label: "Open in the editor", accelerator: "Enter" },
      { label: "Previous or next document", accelerator: "Alt+Up / Alt+Down" },
      { label: "Find in the document", accelerator: "CmdOrCtrl+F" },
      { label: "Move through History's commits", accelerator: "Up / Down" },
    ],
  },
  {
    title: "Editor",
    items: [
      { label: "Find and replace", accelerator: "CmdOrCtrl+F" },
      { label: "Next match", accelerator: "CmdOrCtrl+G" },
      { label: "Bold", accelerator: "CmdOrCtrl+B" },
      { label: "Italic", accelerator: "CmdOrCtrl+I" },
      { label: "Inline code", accelerator: "CmdOrCtrl+E" },
      { label: "Link", accelerator: "CmdOrCtrl+Shift+K" },
      { label: "Jump to a heading", accelerator: "CmdOrCtrl+Shift+O" },
      { label: "Focus mode", accelerator: "CmdOrCtrl+Alt+P" },
      { label: "Leave the text, then Tab onward", accelerator: "Escape" },
    ],
  },
];

/**
 * Help ▸ Keyboard Shortcuts, generated from the menus themselves so the sheet can never
 * promise a key the menus don't have — the capture shortcut included, whatever it was
 * changed to. Sections built from a role (Edit, Window) are the system's own and left out.
 */
export function shortcutGroups(sections: MenuSectionData[]): ShortcutGroup[] {
  const fromMenus = sections
    .filter((s) => s.label && s.items)
    .map((s) => ({
      title: s.label === "Marasca" ? "App" : (s.label as string),
      items: (s.items ?? []).flatMap((i) =>
        "label" in i && i.accelerator ? [{ label: i.label, accelerator: i.accelerator }] : [],
      ),
    }))
    .filter((g) => g.items.length > 0);

  return [...fromMenus, ...IN_WINDOW];
}
