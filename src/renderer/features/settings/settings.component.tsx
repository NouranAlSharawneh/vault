import { ArrowLeft, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { Button, Card, Empty, SectionLabel } from "@/components/ui";
import { PUSH_DEBOUNCE_LABELS } from "@/data/settings.data";
import { describeToken, plural, shortPath } from "@/helpers";
import { api } from "@/lib/api";
import { useSettings } from "./hooks/use-settings.hook";
import { HotkeyRecorder } from "./components/hotkey-recorder/hotkey-recorder.component";
import { SettingRow } from "./components/setting-row/setting-row.component";

/** ⌘, — capture shortcut, sync cadence, vault folders, trash, account. */
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
  return (
    <div className="flex h-full flex-col bg-paper-2">
      <header className="flex h-12 shrink-0 items-center pr-3 pl-titlebar drag">
        <Button variant="ghost" size="sm" className="no-drag" onClick={s.back}>
          <ArrowLeft size={12} /> Back to vault
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10">
        <Card className="mx-auto max-w-2xl divide-y divide-line px-6 py-2">
          <section className="py-4">
            <SectionLabel className="mb-1">Capture</SectionLabel>
            <SettingRow
              label="Shortcut"
              description={
                s.error ? (
                  <span className="text-cherry">{s.error}</span>
                ) : (
                  "Works from any app. Click, then press the combination you want."
                )
              }
            >
              <HotkeyRecorder
                value={config.hotkey}
                onChange={(hotkey) => s.update({ hotkey })}
                busy={s.busy === "hotkey"}
              />
            </SettingRow>
          </section>

          <section className="py-4">
            <SectionLabel className="mb-1">Sync</SectionLabel>
            <SettingRow
              label="Push to GitHub"
              description={
                config.remote ? (
                  <>
                    Every save commits at once; this is how long Vault waits before pushing to{" "}
                    <span className="font-mono">{config.remote}</span>.
                  </>
                ) : (
                  "Local-only vault — nothing is pushed."
                )
              }
            >
              <select
                className="input input-sm w-44 cursor-pointer"
                value={config.pushDebounceMs}
                disabled={!config.remote || s.busy === "pushDebounceMs"}
                onChange={(e) => void s.update({ pushDebounceMs: Number(e.target.value) })}
                aria-label="push delay"
              >
                {PUSH_DEBOUNCE_LABELS.map((o) => (
                  <option key={o.ms} value={o.ms}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SettingRow>
          </section>

          <section className="py-4">
            <SectionLabel className="mb-1">Vault</SectionLabel>
            <SettingRow
              label="Folder"
              description={<span className="font-mono">{shortPath(config.root)}</span>}
            >
              <Button variant="outline" size="sm" onClick={() => api("vault:revealInFinder")}>
                <FolderOpen size={11} /> Reveal in Finder
              </Button>
              <Button variant="outline" size="sm" onClick={() => api("vault:rescan")}>
                <RefreshCw size={11} /> Rescan
              </Button>
            </SettingRow>
            <SettingRow
              label="Trash"
              description={
                s.trashCount
                  ? `${plural(s.trashCount, "document")} waiting. You can restore from the trash view; emptying removes them from git for good.`
                  : "Empty."
              }
            >
              <Button
                variant="outline"
                size="sm"
                disabled={!s.trashCount}
                onClick={() => (window.location.hash = "main?trash")}
              >
                View trash
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!s.trashCount}
                loading={s.busy === "trash"}
                onClick={() => void s.emptyTrash()}
              >
                <Trash2 size={11} /> Empty trash
              </Button>
            </SettingRow>
            <SettingRow
              label="Image folders"
              description={
                assetDirs.length
                  ? "Where relative image paths resolve when you capture into each project."
                  : "None remembered yet — Vault asks the first time a capture references relative images."
              }
            >
              <div className="flex max-w-xs flex-col items-end gap-1">
                {assetDirs.map(([slug, dir]) => (
                  <div key={slug} className="flex items-center gap-2 text-xs">
                    <span className="text-ink-2">{s.projectNames.get(slug) ?? slug}</span>
                    <span className="truncate font-mono text-ink-4" title={dir}>
                      {shortPath(dir)}
                    </span>
                    <Button variant="subtle" onClick={() => void s.forgetAssetDir(slug)}>
                      forget
                    </Button>
                  </div>
                ))}
              </div>
            </SettingRow>
          </section>

          <section className="py-4">
            <SectionLabel className="mb-1">Account</SectionLabel>
            <SettingRow
              label={s.auth.user ? `@${s.auth.user.login}` : "Not signed in"}
              description={
                s.auth.user ? (
                  <>
                    {plural(s.docCount, "document")} · {config.remote ?? "local only"}
                    {describeToken(s.token) && (
                      <div className="mt-0.5 text-ink-4">{describeToken(s.token)}</div>
                    )}
                  </>
                ) : (
                  "Sign in to push to GitHub."
                )
              }
            >
              {s.auth.user ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={s.busy === "signOut"}
                  onClick={() => void s.signOut()}
                >
                  Sign out
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => (window.location.hash = "onboarding?signin")}
                >
                  Sign in
                </Button>
              )}
            </SettingRow>
            {s.auth.status === "signed-in" && !s.config?.remote && (
              <SettingRow
                label="GitHub repo"
                description="This vault is local only. Pick a repo to push it to, or create a new private one."
              >
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => (window.location.hash = "onboarding?connect")}
                >
                  Connect a repo
                </Button>
              </SettingRow>
            )}
            <SettingRow
              label="Reset Vault"
              description="Forget this vault and sign out. The files and git history stay on disk."
            >
              <Button variant="danger" size="sm" onClick={s.reset}>
                Reset…
              </Button>
            </SettingRow>
          </section>
        </Card>
      </div>
    </div>
  );
}
