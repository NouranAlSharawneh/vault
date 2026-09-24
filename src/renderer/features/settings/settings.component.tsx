import { ArrowLeft, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { Button, Dot, Empty, PathText, SettingGroup } from "@/components/ui";
import { PUSH_DEBOUNCE_LABELS } from "@/data/settings.data";
import { describeToken, plural, shortPath } from "@/helpers";
import { api, fire, rescanVault } from "@/lib/api";
import { HotkeyRecorder } from "./components/hotkey-recorder/hotkey-recorder.component";
import { SettingRow } from "./components/setting-row/setting-row.component";
import { useSettings } from "./hooks/use-settings.hook";

/**
 * ⌘, — four groups in the order people reach for them: the capture shortcut, the GitHub
 * side, where things live on disk, and last, apart from the rest, what can't be undone.
 */
export function Settings() {
  const s = useSettings();
  const config = s.config;
  if (!config) {
    return (
      <Empty
        title="No vault connected"
        action={
          <Button variant="primary" onClick={() => (window.location.hash = "onboarding?signin")}>
            Set up Vault
          </Button>
        }
      />
    );
  }
  const assetDirs = Object.entries(config.assetDirs ?? {});
  const user = s.auth.user;
  const signedIn = s.auth.status === "signed-in";

  return (
    <div className="flex h-full flex-col bg-paper-2">
      <header className="flex h-12 shrink-0 items-center pr-3 pl-titlebar drag">
        <Button variant="ghost" size="sm" className="no-drag" onClick={s.back}>
          <ArrowLeft size={12} /> Back to vault
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6">
        <div className="mx-auto flex max-w-150 flex-col gap-7 pt-6 pb-10">
          {/* The header gets more room below it than the groups get between them, so it
              reads as the page's title rather than the first item in the list. */}
          <header className="mb-3 flex flex-col gap-1">
            <h1 className="font-serif text-4xl font-medium tracking-tight text-ink">Settings</h1>
            <p className="text-md text-ink-3">
              How Vault captures, syncs and stores your documents.
            </p>
          </header>

          <SettingGroup title="Capture">
            <SettingRow
              label="Capture shortcut"
              description={
                s.error ? (
                  <span className="text-cherry">{s.error}</span>
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

          <SettingGroup title="GitHub">
            {user ? (
              <SettingRow
                leading={
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="size-7 shrink-0 rounded-full bg-paper-3"
                  />
                }
                label={`@${user.login}`}
                description={describeToken(s.token) ?? user.name ?? "Signed in"}
              >
                <Button
                  variant="outline"
                  loading={s.busy === "signOut"}
                  onClick={() => fire(s.signOut())}
                >
                  Sign out
                </Button>
              </SettingRow>
            ) : (
              <SettingRow label="Account" description="Sign in to push your vault to GitHub.">
                <Button
                  variant="primary"
                  onClick={() => (window.location.hash = "onboarding?signin")}
                >
                  Sign in
                </Button>
              </SettingRow>
            )}

            {config.remote ? (
              <SettingRow
                label="Repository"
                description={
                  <span className="flex items-center gap-1.5">
                    <Dot tone="bg-ok" size={6} />
                    <span className="truncate font-mono">{config.remote}</span>
                    <span className="shrink-0">· {config.branch}</span>
                  </span>
                }
              />
            ) : (
              <SettingRow
                label="Repository"
                description={
                  signedIn
                    ? "Local only. Pick a repo to push to, or create a new private one."
                    : "Local only — nothing is pushed."
                }
              >
                {signedIn && (
                  <Button
                    variant="primary"
                    onClick={() => (window.location.hash = "onboarding?connect")}
                  >
                    Connect a repo
                  </Button>
                )}
              </SettingRow>
            )}

            {config.remote && (
              <SettingRow
                label="Push after saving"
                description="How long to wait after each commit."
              >
                <select
                  className="input input-sm w-42 cursor-pointer"
                  value={config.pushDebounceMs}
                  disabled={s.busy === "pushDebounceMs"}
                  onChange={(e) => fire(s.update({ pushDebounceMs: Number(e.target.value) }))}
                  aria-label="push delay"
                >
                  {PUSH_DEBOUNCE_LABELS.map((o) => (
                    <option key={o.ms} value={o.ms}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </SettingRow>
            )}
          </SettingGroup>

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

            <SettingRow
              label="Image folders"
              count={assetDirs.length || undefined}
              description={
                assetDirs.length
                  ? "Where relative image paths resolve when you capture into a project."
                  : "None yet — Vault asks the first time a capture references relative images."
              }
            />
            {assetDirs.map(([slug, dir]) => (
              <SettingRow
                key={slug}
                nested
                label={s.projectNames.get(slug) ?? slug}
                description={<PathText path={shortPath(dir)} className="block" />}
              >
                <Button variant="outline" onClick={() => fire(s.forgetAssetDir(slug))}>
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

          <SettingGroup title="Danger zone" tone="danger">
            <SettingRow
              label="Empty trash"
              description={
                s.trashCount
                  ? `Removes ${plural(s.trashCount, "document")} from git for good.`
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
              label="Reset Vault"
              description="Forget this vault and sign out. Files and git history stay on disk."
            >
              <Button variant="danger" onClick={s.reset}>
                Reset…
              </Button>
            </SettingRow>
          </SettingGroup>

          {s.version && (
            <p className="text-center font-mono text-2xs text-ink-4">Vault {s.version}</p>
          )}
        </div>
      </div>
    </div>
  );
}
