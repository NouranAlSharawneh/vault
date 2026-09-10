import type { DocMeta } from "@shared/types";
import type { PaletteActionKey } from "@/data/palette.data";

export interface CommandPaletteProps {
  onClose: () => void;
  onOpenDoc: (path: string) => void;
}

export type PaletteItem =
  | { kind: "doc"; doc: DocMeta; snippet?: string | null }
  | { kind: "text"; doc: DocMeta; snippet: string }
  | { kind: "action"; key: PaletteActionKey; label: string; shortcut?: string };

export interface PaletteGroup {
  title: string;
  items: PaletteItem[];
}
