import { PanelLeft, Plus, Search } from "lucide-react";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { Button } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { api, fire } from "@/lib/api";
import type { TopBarProps } from "./top-bar.types";

/** What the sidebar button does next: it cycles full → icons → hidden → full. */
const SIDEBAR_NEXT = {
  full: "Collapse the sidebar to icons",
  rail: "Hide the sidebar",
  hidden: "Show the sidebar",
} as const;

/**
 * Full-width title bar: sidebar toggle · centred search pill (opens ⌘K) · sync · New.
 *
 * The bar itself drags the window; only the controls opt out. The two side groups used to
 * be `no-drag` whole, and as grid columns they stretched to fill the bar, so the window
 * could only be moved by a few strips around the edges.
 */
export function TopBar({ sidebar, onToggleSidebar, onSearch, onReviewConflicts }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 bg-paper-2 pr-2 pl-titlebar drag">
      {/* The sides grow alike, so the pill sits centred, but never below their own
          content: when room runs out, the pill gives way instead of the buttons. */}
      <div className="flex min-w-fit flex-1 basis-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="no-drag"
          onClick={onToggleSidebar}
          tooltip={SIDEBAR_NEXT[sidebar]}
          tooltipKeys={`${MOD_KEY}\\`}
          aria-label={SIDEBAR_NEXT[sidebar]}
        >
          <PanelLeft size={14} />
        </Button>
      </div>
      {/* Shrinks before anything overflows: at the narrowest window, or beside a long sync
          state, a fixed 520px pill pushed New off the edge. */}
      <Button
        variant="outline"
        className="h-8 w-130 min-w-24 shrink justify-between rounded-md bg-paper-3/70 font-normal text-ink-4 no-drag hover:bg-paper-3"
        onClick={onSearch}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search size={12} className="shrink-0" />{" "}
          <span className="truncate">Search your docs</span>
        </span>
        <span className="shrink-0 text-xs text-ink-4">{MOD_KEY} K</span>
      </Button>
      <div className="flex min-w-fit flex-1 basis-0 items-center justify-end gap-2">
        <SyncBadge onReviewConflicts={onReviewConflicts} />
        {/* ⌘N goes in the tooltip, like every other shortcut in the app: printed on the
            cherry fill it cluttered the one button that should read cleanly. */}
        <Button
          variant="primary"
          size="sm"
          className="shrink-0 no-drag"
          onClick={() => fire(api("window:openEditor"), "Couldn’t open the editor")}
          tooltip="New document"
          tooltipKeys={`${MOD_KEY}N`}
        >
          <Plus size={12} /> New
        </Button>
      </div>
    </header>
  );
}
