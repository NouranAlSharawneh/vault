import { useMemo } from "react";
import { headingsOf } from "@/helpers";
import { OutlinePopover } from "../outline-popover/outline-popover.component";
import { ShortcutsPopover } from "../shortcuts-popover/shortcuts-popover.component";
import type { EditorPanelsProps } from "./editor-panels.types";

/** The editor's two overlays: the outline (⇧⌘O) and the key list ("?"). One at a time. */
export function EditorPanels({ panel, body, onJump, onClose }: EditorPanelsProps) {
  // Worked out when the outline opens, not on every keystroke while it is shut.
  const headings = useMemo(() => (panel === "outline" ? headingsOf(body) : []), [panel, body]);
  if (panel === "outline")
    return <OutlinePopover headings={headings} onJump={onJump} onClose={onClose} />;
  if (panel === "shortcuts") return <ShortcutsPopover onClose={onClose} />;

  return null;
}
