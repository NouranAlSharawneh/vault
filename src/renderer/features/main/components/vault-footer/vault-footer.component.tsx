import { FolderOpen, Settings } from "lucide-react";
import { Button, GitHubMark, Tooltip } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { shortPath } from "@/helpers";
import { api, fire } from "@/lib/api";
import type { VaultFooterProps } from "./vault-footer.types";

/**
 * Where the vault lives, at the foot of the sidebar. The repo name is the thing to read,
 * so it gets the width: its own line, with the owner beneath it rather than in front
 * (`NouranAlSharawneh/` alone used to fill the row). Clicking it opens the repo, or the
 * folder for a local vault. Settings is the only icon; rescan lives in ⌘K and Settings.
 */
export function VaultFooter({ config, onSettings }: VaultFooterProps) {
  const [owner, name] = config.remote?.split("/") ?? [];
  const remote = !!config.remote;

  return (
    <div className="flex items-center gap-1 border-t border-line px-2 py-2">
      <Tooltip
        label={remote ? "Open on GitHub" : "Show in Finder"}
        side="top"
        className="min-w-0 flex-1"
      >
        <button
          type="button"
          aria-label={
            remote ? `Open ${config.remote} on GitHub` : `Show ${shortPath(config.root)} in Finder`
          }
          className="flex w-full min-w-0 items-center gap-2.5 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-paper-3"
          onClick={() =>
            remote
              ? fire(api("github:openInBrowser"), "Couldn’t open GitHub")
              : fire(api("vault:revealInFinder"), "Couldn’t show the vault in Finder")
          }
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-paper-3 text-ink-2">
            {remote ? <GitHubMark size={13} /> : <FolderOpen size={13} />}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium text-ink-2">{name ?? "Local vault"}</span>
            <span className="truncate text-2xs text-ink-4">
              {remote ? owner : shortPath(config.root)}
            </span>
          </span>
        </button>
      </Tooltip>
      {/* ⌘, and the palette reach Settings too, but neither is something you can see. */}
      <Button
        variant="ghost"
        className="w-7 shrink-0 justify-center px-0"
        onClick={onSettings}
        tooltip="Settings"
        tooltipKeys={`${MOD_KEY},`}
        tooltipSide="top"
        aria-label="settings"
      >
        <Settings size={14} />
      </Button>
    </div>
  );
}
