import type { SyncState } from "@shared/types";

export interface SyncPresentation {
  label: (ahead: number) => string;
  /** Tailwind colour class for the dot. Green/amber are reserved for sync per the PRD. */
  dot: string;
  busy?: boolean;
}

export const SYNC_PRESENTATION: Record<SyncState, SyncPresentation> = {
  synced: { label: () => "pushed", dot: "bg-ok" },
  pending: { label: (n) => (n > 0 ? `${n} not pushed` : "not pushed"), dot: "bg-warn" },
  pushing: { label: () => "pushing…", dot: "bg-warn", busy: true },
  offline: { label: (n) => `offline · ${n} waiting`, dot: "bg-warn" },
  conflict: { label: () => "conflict", dot: "bg-cherry" },
  error: { label: () => "push failed", dot: "bg-cherry" },
};
