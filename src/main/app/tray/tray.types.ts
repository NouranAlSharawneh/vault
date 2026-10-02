import type { DocMeta, SyncStatus } from "@shared/types";

export interface TrayState {
  hasVault: boolean;
  remote: string | null;
  sync: SyncStatus | null;
  /** Newest first, already cut to the few the menu shows. */
  recent: Pick<DocMeta, "path" | "title">[];
}

export type TrayMenuItem =
  | { kind: "separator" }
  /** A line of text that can't be clicked (the sync state, "Nothing captured yet"). */
  | { kind: "note"; label: string }
  | { kind: "action"; action: "capture" | "open" | "quit"; label: string; enabled?: boolean }
  | { kind: "doc"; label: string; path: string };
