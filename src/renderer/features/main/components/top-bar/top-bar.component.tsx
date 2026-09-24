import { PanelLeft, Plus, Search } from "lucide-react";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { Button } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { api, fire } from "@/lib/api";
import type { TopBarProps } from "./top-bar.types";

/** Full-width title bar: sidebar toggle · centred search pill (opens ⌘K) · sync · New. */
export function TopBar({ sidebar, onToggleSidebar, onSearch, onReviewConflicts }: TopBarProps) {
  return (
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-paper-2 pr-3 pl-titlebar drag">
      <div className="flex items-center gap-1 no-drag">
        <Button
          variant="ghost"
          size="sm"
          className="w-7 px-0"
          onClick={onToggleSidebar}
          title={`Sidebar (${MOD_KEY}\\)`}
          aria-label="toggle sidebar"
          aria-pressed={sidebar !== "hidden"}
        >
          <PanelLeft size={13} />
        </Button>
      </div>
      <Button
        variant="outline"
        className="h-8 w-130 justify-between rounded-md bg-paper-3/70 font-normal text-ink-4 no-drag hover:bg-paper-3"
        onClick={onSearch}
      >
        <span className="flex items-center gap-2">
          <Search size={12} /> Search your docs
        </span>
        <span className="text-xs text-ink-4">{MOD_KEY} K</span>
      </Button>
      <div className="flex items-center justify-end gap-2 no-drag">
        <SyncBadge onReviewConflicts={onReviewConflicts} />
        {/* ⌘N goes in the tooltip, like every other shortcut in the app: printed on the
            cherry fill it cluttered the one button that should read cleanly. */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => fire(api("window:openEditor"), "Couldn’t open the editor")}
          tooltip="New document"
          tooltipKeys={`${MOD_KEY}N`}
        >
          <Plus size={11} /> New
        </Button>
      </div>
    </header>
  );
}
