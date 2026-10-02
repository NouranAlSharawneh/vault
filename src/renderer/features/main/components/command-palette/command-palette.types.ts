import type { PaletteActionKey } from "@/data/palette.data";
import type { DocMeta } from "@shared/types";
import type { ListFilter } from "../../main.types";

/** The part of the list filter a palette query can set. */
export type PaletteListFilter = Pick<ListFilter, "collection" | "project" | "tags">;

export interface CommandPaletteProps {
  onClose: () => void;
  onOpenDoc: (path: string) => void;
  /** Present while a doc is open in the reader; enables the trash action. */
  onTrashDoc?: () => void;
  /** Title of the doc `onTrashDoc` acts on, so the action says which one it will trash. */
  trashTitle?: string;
  /** Opens the review of documents that changed in two places. */
  onReviewConflicts?: () => void;
  /** Show what the query found in the library list. */
  onShowInList?: (filter: PaletteListFilter) => void;
}

export type PaletteItem =
  | { kind: "doc"; doc: DocMeta; snippet?: string | null }
  | { kind: "text"; doc: DocMeta; snippet: string }
  | { kind: "action"; key: PaletteActionKey; label: string; shortcut?: string };

export interface PaletteGroup {
  title: string;
  items: PaletteItem[];
}
