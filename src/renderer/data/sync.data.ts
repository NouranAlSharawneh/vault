import type { SyncState } from "@shared/types";

export interface SyncPresentation {
  label: (ahead: number) => string;
  /** Tailwind colour class for the dot. Green/amber are reserved for sync per the PRD. */
  dot: string;
  busy?: boolean;
}

/**
 * Three very different situations used to look identical: "I am about to send this",
 * "I am sending it" and "I cannot send it" all showed the same amber dot. Only the two
 * that are genuinely in-progress share a colour now, and every label that describes a
 * problem says what to do about it.
 */
export const SYNC_PRESENTATION: Record<SyncState, SyncPresentation> = {
  synced: { label: () => "pushed", dot: "bg-ok" },
  pending: { label: (n) => (n > 0 ? `${n} not pushed` : "not pushed"), dot: "bg-warn" },
  pushing: { label: () => "pushing…", dot: "bg-warn", busy: true },
  offline: { label: (n) => (n > 0 ? `offline · ${n} waiting` : "offline"), dot: "bg-ink-4" },
  error: { label: () => "couldn't push — retry", dot: "bg-cherry" },
};
