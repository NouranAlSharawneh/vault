import { ArrowLeft, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Button, Empty, PathText, SettingGroup } from "@/components/ui";
import { isEditableTarget, plural, shortPath } from "@/helpers";
import { api, fire, rescanVault } from "@/lib/api";
import { GitRow } from "./components/git-row/git-row.component";
import { GitHubGroup } from "./components/github-group/github-group.component";
import { HotkeyRecorder } from "./components/hotkey-recorder/hotkey-recorder.component";
import { SettingRow } from "./components/setting-row/setting-row.component";
import { UpdateCheck } from "./components/update-check/update-check.component";
import { useSettings } from "./hooks/use-settings.hook";

/**
 * ⌘, — five groups in the order people reach for them: the capture shortcut, the GitHub
 * side, where things live on disk, updates, and last, apart from the rest, what can't be
 * undone.
 */
export function Settings() {
  const s = useSettings();
  const config = s.config;
  const { back } = s;
  // Esc or ⌘[ goes back, the way every other page-like view on a Mac does. Not from a
  // field or an open select, where Escape already means something; the shortcut
  // recorder keeps its own Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      const bracket = e.key === "[" && (e.metaKey || e.ctrlKey);
      if (e.key === "Escape" || bracket) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [back]);
  if (!config) {
    return (
      <div className="flex h-full flex-col bg-paper-2">
        <div className="h-12 shrink-0 drag" />
        <Empty
          title="No vault connected"
          action={
            <Button variant="primary" onClick={() => (window.location.hash = "onboarding?signin")}>
              Set up Marasca
            </Button>
          }
        />
      </div>
    );
  }
  const assetDirs = Object.entries(config.assetDirs ?? {});
  const hotkeyError = s.errorFor("hotkey");
  const foldersError = s.errorFor("assetDirs");

  return (
    <div className="flex h-full flex-col bg-paper-2">
      <header className="flex h-12 shrink-0 items-center pr-2 pl-titlebar drag">
        <Button variant="ghost" size="sm" className="no-drag" onClick={s.back}>
          <ArrowLeft size={12} /> Back to vault
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6">
        {/* pb-24: the Danger zone scrolls clear of a toast instead of sitting under it. */}
        <div className="mx-auto flex max-w-150 flex-col gap-7 pt-6 pb-24">
          {/* The header gets more room below it than the groups get between them, so it
              reads as the page's title rather than the first item in the list. */}
          <header className="mb-3 flex flex-col gap-1">
            <h1 className="font-serif text-4xl font-medium tracking-tight text-ink">Settings</h1>
            <p className="text-md text-ink-3">
              How Marasca captures, syncs and stores your documents.
            </p>
          </header>

          <SettingGroup title="Capture">
            <SettingRow
              label="Capture shortcut"
              description={
                hotkeyError ? (
                  <span className="text-cherry">{hotkeyError}</span>
                ) : s.hotkeyTaken ? (
                  <span className="text-cherry">
                    Not active — another app is using this shortcut.
                  </span>
                ) : (
                  "Opens the capture sheet from any app. Click to change it."
                )
              }
            >
              <HotkeyRecorder
                value={config.hotkey}
                onChange={(hotkey) => s.update({ hotkey })}
                busy={s.busy === "hotkey"}
              />
            </SettingRow>
          </SettingGroup>

          <GitHubGroup s={s} config={config} />

          <SettingGroup title="Storage">
            <SettingRow
              label="Vault folder"
              description={<PathText path={shortPath(config.root)} className="block" />}
            >
              <Button
                variant="outline"
                onClick={() =>
                  fire(api("vault:revealInFinder"), "Couldn’t show the vault in Finder")
                }
              >
                <FolderOpen size={12} /> Show in Finder
              </Button>
              <Button
                variant="outline"
                className="w-7 justify-center px-0"
                tooltip="Rescan the folder"
                aria-label="Rescan the folder"
                onClick={rescanVault}
              >
                <RefreshCw size={12} />
              </Button>
            </SettingRow>

            <GitRow />

            <SettingRow
              label="Image folders"
              count={assetDirs.length || undefined}
              description={
                foldersError ? (
                  <span className="text-cherry">{foldersError}</span>
                ) : assetDirs.length ? (
                  "Where relative image paths resolve when you capture into a project."
                ) : (
                  "None yet — Marasca asks the first time a capture references relative images."
                )
              }
            />
            {assetDirs.map(([slug, dir]) => (
              <SettingRow
                key={slug}
                nested
                label={s.projectNames.get(slug) ?? slug}
                description={<PathText path={shortPath(dir)} className="block" />}
              >
                <Button
                  variant="outline"
                  // One at a time: each is written from the list on screen, and two quick
                  // clicks brought the first folder back.
                  disabled={s.busy === "assetDirs"}
                  aria-label={`Forget the image folder for ${s.projectNames.get(slug) ?? slug}`}
                  onClick={() => fire(s.forgetAssetDir(slug))}
                >
                  Forget
                </Button>
              </SettingRow>
            ))}

            <SettingRow
              label="Trash"
              count={s.trashCount || undefined}
              description={
                s.trashCount ? "Restore documents from here, or empty it below." : "Empty."
              }
            >
              <Button variant="outline" onClick={() => (window.location.hash = "main?trash")}>
                Open trash
              </Button>
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="Updates">
            <UpdateCheck version={s.version || "…"} />
          </SettingGroup>

          <SettingGroup title="Danger zone" tone="danger">
            <SettingRow
              label="Empty trash"
              description={
                s.trashCount
                  ? `Deletes ${plural(s.trashCount, "document")} from the vault. Earlier versions stay in git history.`
                  : "Nothing in the trash."
              }
            >
              <Button
                variant="danger"
                disabled={!s.trashCount}
                loading={s.busy === "trash"}
                onClick={() => fire(s.emptyTrash())}
              >
                <Trash2 size={12} /> Empty trash…
              </Button>
            </SettingRow>
            <SettingRow
              label="Reset Marasca"
              description="Forget this vault and sign out. Files and git history stay on disk."
            >
              <Button variant="danger" onClick={s.reset}>
                Reset…
              </Button>
            </SettingRow>
          </SettingGroup>
        </div>
      </div>
    </div>
  );
}
