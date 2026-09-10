import { app, dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BRANCH, DEFAULT_HOTKEY, DEFAULT_PUSH_DEBOUNCE_MS } from "@shared/constants";
import type { InvokeChannel, IpcInvoke } from "@shared/ipc";
import type { IpcHandler } from "./ipc.types";
import type { VaultConfig } from "@shared/types";
import { NetworkError } from "../../network/axios";
import {
  createRepo,
  listRepos,
  openOnGitHub,
  pollDeviceFlow,
  startDeviceFlow,
} from "../../network/github";
import { readClipboard } from "../../services/capture/capture.service";
import { GitService } from "../../services/git/git.service";
import { getSettings, updateSettings } from "../../store/settings.store";
import { loadToken } from "../../store/token.store";
import { getOAuthConfig } from "../../store/oauth-config";
import { cancelWebFlow, runWebFlow } from "../../services/auth/web-flow.service";
import { broadcast, hideCaptureWindow, openEditorWindow, openMainWindow } from "../../windows";
import { registerHotkey } from "../hotkey/hotkey";
import { buildAppMenu } from "../menu/menu";
import { resetApp } from "../session/reset-app";
import { resolveAssets } from "../../services/assets";
import { session } from "../session/session";

/** Typed `ipcMain.handle` that normalises errors so the renderer sees a plain message. */
function handle<C extends InvokeChannel>(channel: C, fn: IpcHandler<C>): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...(args as Parameters<IpcInvoke[C]>));
    } catch (e) {
      if (e instanceof NetworkError && e.isAuth) session.markAuthExpired();
      throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
    }
  });
}

let deviceAbort: AbortController | null = null;

export function registerIpcHandlers(): void {
  handle("app:version", () => app.getVersion());
  handle("app:platform", () => process.platform);
  handle("app:openExternal", (url) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });

  // ---- auth
  handle("auth:state", () => session.auth);
  handle("auth:signInWithToken", (token) => session.signIn(token.trim(), "pat"));
  handle("auth:methods", () => {
    const cfg = getOAuthConfig();
    return { oauth: !!cfg?.clientSecret, device: !!cfg };
  });
  handle("auth:deviceAvailable", () => !!getOAuthConfig());
  handle("auth:webStart", () => {
    const cfg = getOAuthConfig();
    if (!cfg) throw new Error("No GitHub OAuth App configured. See .env.example.");
    // Fire-and-forget: progress arrives on auth:webStatus, the token via auth:state.
    void runWebFlow(cfg, (status, message) => broadcast("auth:webStatus", { status, message }))
      .then((token) => session.signIn(token, "oauth"))
      .catch((e: unknown) => {
        if (!(e instanceof Error && (e.message === "cancelled" || e.message === "timeout")))
          console.warn("web flow failed", e);
      });
  });
  handle("auth:webCancel", () => cancelWebFlow());
  handle("auth:deviceStart", async () => {
    const clientId = getOAuthConfig()?.clientId;
    if (!clientId) throw new Error("No GitHub OAuth client ID configured. Paste a token instead.");
    deviceAbort?.abort();
    deviceAbort = new AbortController();
    const { deviceCode, ...publicSession } = await startDeviceFlow(clientId);
    void shell.openExternal(publicSession.verificationUri);
    const { signal } = deviceAbort;
    void pollDeviceFlow(clientId, deviceCode, publicSession.interval, signal, (status) =>
      broadcast("auth:deviceStatus", { status }),
    )
      .then((token) => session.signIn(token, "device"))
      .catch((e: unknown) => {
        if (!signal.aborted) console.warn("device flow failed", e);
      });
    return publicSession;
  });
  handle("auth:deviceCancel", () => deviceAbort?.abort());
  handle("auth:signOut", () => session.signOut());

  // ---- github
  handle("github:listRepos", () => listRepos());
  handle("github:createRepo", (name, isPrivate) => createRepo(name, isPrivate));
  handle("github:openInBrowser", (path) =>
    openOnGitHub(path ?? session.vault?.config.remote ?? ""),
  );

  // ---- vault lifecycle
  handle("vault:config", () => getSettings().vault);
  handle("vault:defaultPath", (name) => join(homedir(), "Documents", name));
  handle("vault:chooseFolder", async () => {
    const r = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      defaultPath: join(homedir(), "Documents"),
    });
    return r.canceled ? null : r.filePaths[0];
  });
  handle("vault:setup", async ({ repo, localPath }) => {
    if (!(await GitService.isAvailable())) {
      throw new Error("git is not installed. On macOS run `xcode-select --install` and try again.");
    }
    const config: VaultConfig = {
      root: localPath,
      remote: repo?.fullName ?? null,
      branch: repo?.defaultBranch ?? DEFAULT_BRANCH,
      lastProject: null,
      lastSource: "claude",
      hotkey: DEFAULT_HOTKEY,
      pushDebounceMs: DEFAULT_PUSH_DEBOUNCE_MS,
    };
    if (repo && !existsSync(join(localPath, ".git"))) {
      try {
        await GitService.clone(repo.cloneUrl, localPath, loadToken(), repo.defaultBranch);
      } catch {
        // An empty repo can't be cloned; init locally and point origin at it below.
      }
    }
    if (!existsSync(join(localPath, ".git"))) await GitService.init(localPath, config.branch);
    updateSettings({ vault: config, onboarded: true });
    const vault = await session.openVault(config);
    if (repo) {
      await vault.git.setRemote(repo.cloneUrl);
      vault.schedulePush();
    }
    registerHotkey(config.hotkey);
    return config;
  });
  handle("vault:updateConfig", (patch) => {
    const current = getSettings().vault;
    if (!current) throw new Error("No vault");
    const next = { ...current, ...patch };
    if (patch.hotkey && patch.hotkey !== current.hotkey && !registerHotkey(patch.hotkey)) {
      registerHotkey(current.hotkey);
      throw new Error(`${patch.hotkey} is taken by another app or isn't a valid shortcut.`);
    }
    updateSettings({ vault: next });
    if (session.vault) Object.assign(session.vault.config, next);
    if (patch.hotkey) buildAppMenu(next.hotkey);
    return next;
  });
  handle("app:reset", () => resetApp());
  handle("vault:index", () => session.requireVault().index.snapshot());
  handle("vault:rescan", () => session.requireVault().index.rescan());
  handle("vault:disconnect", async () => {
    await session.closeVault();
    updateSettings({ vault: null, onboarded: false });
  });
  handle("vault:revealInFinder", (p) =>
    shell.showItemInFolder(join(session.requireVault().root, p ?? "")),
  );

  // ---- docs
  handle("doc:read", (p) => session.requireVault().read(p));
  handle("doc:save", async (req) => {
    const vault = session.requireVault();
    const res = await vault.save(req);
    Object.assign(vault.config, {
      lastProject: req.frontmatter.project || null,
      lastSource: req.frontmatter.source,
    });
    updateSettings({ vault: vault.config });
    return res;
  });
  handle("doc:trash", (p) => session.requireVault().trash(p));
  handle("trash:list", () => session.requireVault().listTrash());
  handle("trash:read", (p) => session.requireVault().readTrashed(p));
  handle("trash:restore", (p) => session.requireVault().restoreFromTrash(p));
  handle("trash:purge", (p) => session.requireVault().purgeTrash(p));
  handle("doc:setStarred", (p, starred) => session.requireVault().setStarred(p, starred));
  handle("doc:history", (p) => session.requireVault().history(p));
  handle("doc:atCommit", (p, sha) => session.requireVault().atCommit(p, sha));
  handle("doc:restore", (p, sha) => session.requireVault().restore(p, sha));
  handle("doc:pathPreview", (project, title) => session.requireVault().previewPath(project, title));

  // ---- projects
  handle("project:rename", (from, to) => session.requireVault().renameProject(from, to));
  handle("project:list", () => session.requireVault().projects());

  // ---- sync
  handle("sync:status", () => session.requireVault().status());
  handle("sync:pushNow", () => session.requireVault().pushNow());
  handle("sync:pull", () => session.requireVault().pull());
  handle("sync:resolveConflict", (p, choice) => session.requireVault().resolveConflict(p, choice));

  // ---- views / templates / search
  handle("views:list", () => session.requireVault().listViews());
  handle("views:save", (v) => session.requireVault().saveView(v));
  handle("views:delete", (n) => session.requireVault().deleteView(n));
  handle("templates:list", () => session.requireVault().listTemplates());
  handle("search:query", (text) => session.vault?.search(text) ?? []);

  // ---- capture
  handle("assets:resolve", (baseDir, refs) => resolveAssets(baseDir, refs));
  handle("assets:chooseFolder", async (defaultPath) => {
    const r = await dialog.showOpenDialog({
      title: "Where are these images relative to?",
      properties: ["openDirectory"],
      defaultPath: defaultPath ?? join(homedir(), "Documents"),
    });
    return r.canceled ? null : r.filePaths[0];
  });
  handle("capture:readClipboard", () => readClipboard());
  handle("capture:hide", () => hideCaptureWindow());
  handle("capture:openEditor", (draft) => {
    hideCaptureWindow();
    const win = openEditorWindow();
    win.webContents.once("did-finish-load", () => win.webContents.send("editor:open", { draft }));
  });

  // ---- windows
  handle("window:openMain", (route) => void openMainWindow(route));
  handle("window:openEditor", (p) => {
    const win = openEditorWindow(p ? `?path=${encodeURIComponent(p)}` : "");
    if (p)
      win.webContents.once("did-finish-load", () =>
        win.webContents.send("editor:open", { path: p }),
      );
  });
}
