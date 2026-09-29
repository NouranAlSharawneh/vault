import { TRAY_RECENT_COUNT } from "@shared/constants";
import type { DocMeta, SyncStatus } from "@shared/types";
import type { TrayMenuItem, TrayState } from "./tray.types";

/** What the sync badge would say, in the few words a menu has room for. */
export function syncLine(sync: SyncStatus | null, remote: string | null): string {
  if (!remote) return "Local vault — nothing to push";
  if (!sync) return "Checking GitHub…";
  if (sync.conflicts > 0) return `${sync.conflicts} to review — open Marasca`;
  switch (sync.state) {
    case "pushing":
      return "Pushing to GitHub…";
    case "pending":
      return sync.ahead > 0 ? `${sync.ahead} waiting to push` : "Waiting to push";
    case "offline":
      return "Offline — pushes resume when you're back";
    case "error":
      return "Couldn't sync — open Marasca";
    default:
      return sync.behind > 0 ? `${sync.behind} new on GitHub` : "Pushed to GitHub";
  }
}

/** The documents captured last, newest first. */
export function recentDocs(docs: DocMeta[], count = TRAY_RECENT_COUNT): TrayState["recent"] {
  return [...docs]
    .sort((a, b) => (b.created || "").localeCompare(a.created || "") || b.mtime - a.mtime)
    .slice(0, count)
    .map((d) => ({ path: d.path, title: d.title }));
}

/**
 * The menu bar item's menu, as data. Where sync stands first (not clickable), then what
 * you came for: capture, the window, and the few documents captured last.
 */
export function trayMenu(s: TrayState): TrayMenuItem[] {
  const recent: TrayMenuItem[] = s.recent.length
    ? s.recent.map((d) => ({ kind: "doc", label: d.title || d.path, path: d.path }))
    : [{ kind: "note", label: "Nothing captured yet" }];

  return [
    { kind: "note", label: s.hasVault ? syncLine(s.sync, s.remote) : "No vault set up yet" },
    { kind: "separator" },
    { kind: "action", action: "capture", label: "Capture Clipboard", enabled: s.hasVault },
    { kind: "action", action: "open", label: "Open Marasca" },
    ...(s.hasVault
      ? [{ kind: "separator" } as const, { kind: "note", label: "Recent" } as const, ...recent]
      : []),
    { kind: "separator" },
    { kind: "action", action: "quit", label: "Quit Marasca" },
  ];
}
