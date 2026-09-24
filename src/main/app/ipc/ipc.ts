import { homedir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { InvokeChannel, IpcInvoke } from "@shared/ipc";
import { fire } from "../../lib/fire";
import { NetworkError } from "../../network/axios";
import {
  createRepo,
  listRepos,
  openOnGitHub,
  pollDeviceFlow,
  startDeviceFlow,
} from "../../network/github";
import { resolveAssets } from "../../services/assets";
import { cancelWebFlow, runWebFlow } from "../../services/auth/web-flow.service";
import { readClipboard } from "../../services/capture/capture.service";
import { clearDraft, loadDraft, saveDraft } from "../../store/draft.store";
import { getOAuthConfig } from "../../store/oauth-config";
import { getSettings, updateSettings } from "../../store/settings.store";
import { loadCredentials } from "../../store/token.store";
import {
  broadcast,
  dialogParent,
  hideCaptureWindow,
  IS_MAC,
  isCaptureVisible,
  openEditorWindow,
  openMainWindow,
  resizeCaptureWindow,
  revealDoc,
  setEditorPath,
  takeEditorSeed,
  whileCaptureDialogOpen,
} from "../../windows";
import { hotkeyStatus, registerHotkey } from "../hotkey/hotkey";
import { buildAppMenu } from "../menu/menu";
import { resetApp } from "../session/reset-app";
import { session } from "../session/session";
import { confirmPurge } from "./confirm-purge";
import type { IpcHandler, IpcSenderHandler } from "./ipc.types";
import { setupVault } from "./setup-vault";

/** Typed `ipcMain.handle` that normalises errors so the renderer sees a plain message. */
function handle<C extends InvokeChannel>(channel: C, fn: IpcHandler<C>): void {
  handleFrom(channel, (_sender, ...args) => fn(...args));
}

/** `handle`, for the few handlers that need the window that asked — to parent a dialog to it. */
function handleFrom<C extends InvokeChannel>(channel: C, fn: IpcSenderHandler<C>): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      const sender = BrowserWindow.fromWebContents(event.sender);

      return await fn(sender, ...(args as Parameters<IpcInvoke[C]>));
    } catch (e) {
      if (e instanceof NetworkError && e.isAuth) session.markAuthExpired();
      throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
    }
  });
}

/** Pick a folder, as a sheet on the window that asked when there is one. */
async function chooseFolder(
  sender: BrowserWindow | null,
  options: Electron.OpenDialogOptions,
): Promise<string | null> {
  const parent = dialogParent(sender);
  const r = await (parent
    ? dialog.showOpenDialog(parent, options)
    : dialog.showOpenDialog(options));

  return r.canceled ? null : r.filePaths[0];
}

let deviceAbort: AbortController | null = null;

export function registerIpcHandlers(): void {
  handle("app:version", () => app.getVersion());
  handle("app:platform", () => process.platform);
  handle("hotkey:status", () => hotkeyStatus());
  handle("app:openExternal", (url) => {
    // Web pages and mail drafts only: anything else (file:, custom schemes) could launch
    // an arbitrary app from a link in a pasted document.
    if (/^(?:https?:\/\/|mailto:)/i.test(url)) fire(shell.openExternal(url), "opening a link");
  });

  // ---- auth
  handle("auth:state", () => session.auth);
  handle("auth:signInWithToken", (token) =>
    session.signIn(
      { accessToken: token.trim(), refreshToken: null, expiresAt: null, refreshExpiresAt: null },
      "pat",
    ),
  );
  handle("auth:methods", () => {
    const cfg = getOAuthConfig();

    return { oauth: !!cfg?.clientSecret, device: !!cfg };
  });
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
    fire(shell.openExternal(publicSession.verificationUri), "opening GitHub");
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
  handle("auth:tokenStatus", () => {
    const creds = loadCredentials();

    return {
      present: !!creds,
      expiresAt: creds?.expiresAt ?? null,
      canRefresh: !!creds?.refreshToken && !!getOAuthConfig()?.clientSecret,
    };
  });

  // ---- github
  handle("github:listRepos", () => listRepos());
  handle("github:createRepo", (name, isPrivate) => createRepo(name, isPrivate));
  handle("github:openInBrowser", (path) =>
    openOnGitHub(path ?? session.vault?.config.remote ?? ""),
  );

  // ---- vault lifecycle
  handle("vault:config", () => getSettings().vault);
  handle("vault:defaultPath", (name) => join(homedir(), "Documents", name));
  handleFrom("vault:chooseFolder", (sender) =>
    chooseFolder(sender, {
      properties: ["openDirectory", "createDirectory"],
      defaultPath: join(homedir(), "Documents"),
    }),
  );
  handle("vault:setup", async ({ repo, localPath }) => {
    const config = await setupVault(session, repo, localPath);
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
  handle("draft:save", (key, draft) => saveDraft(key, draft));
  handle("draft:load", (key) => loadDraft(key));
  handle("draft:clear", (key) => clearDraft(key));
  handleFrom("app:reset", (sender) => resetApp(dialogParent(sender)));
  handle("vault:index", () => session.requireVault().index.snapshot());
  handle("vault:rescan", () => session.requireVault().index.rescan());
  handle("vault:revealInFinder", (p) => {
    // The folder is worth showing most when the vault inside it would not open.
    const root = session.vault?.root ?? getSettings().vault?.root;
    if (!root) throw new Error("No vault is set up");
    shell.showItemInFolder(join(root, p ?? ""));
  });
  handle("vault:reopen", async () => {
    const vault = await session.reopenVault();
    registerHotkey(vault.config.hotkey);

    return vault.index.snapshot();
  });

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
  handleFrom("trash:purge", async (sender, p) => {
    const vault = session.requireVault();
    // Asked here so neither the reader nor Settings can skip it.
    if (!(await confirmPurge(p, await vault.listTrash(), dialogParent(sender))))
      return { removed: 0, assets: [] };

    return vault.purgeTrash(p);
  });
  handle("doc:setStarred", (p, starred) => session.requireVault().setStarred(p, starred));
  handle("doc:history", (p) => session.requireVault().history(p));
  handle("doc:restore", (p, sha) => session.requireVault().restore(p, sha));
  handle("doc:diff", (p, sha) => session.requireVault().diff(p, sha));
  handle("doc:pathPreview", (project, title) => session.requireVault().previewPath(project, title));

  // ---- projects
  handle("project:rename", (from, to) => session.requireVault().renameProject(from, to));
  handle("project:list", () => session.requireVault().projects());

  // ---- sync
  handle("sync:status", () => session.requireVault().status());
  handle("sync:pushNow", () => session.requireVault().pushNow());
  handle("sync:pull", () => session.requireVault().pull());
  handle("conflicts:list", () => session.requireVault().conflicts());
  handle("conflicts:resolve", (p, choice) => session.requireVault().resolveConflict(p, choice));

  // ---- views / templates / search
  handle("views:list", () => session.requireVault().listViews());
  handle("views:save", (v) => session.requireVault().saveView(v));
  handle("views:delete", (n) => session.requireVault().deleteView(n));
  handle("templates:list", () => session.requireVault().listTemplates());
  handle("search:query", (text) => session.vault?.search(text) ?? []);

  // ---- capture
  handle("assets:resolve", (baseDir, refs) =>
    resolveAssets(baseDir, refs, Object.values(getSettings().vault?.assetDirs ?? {})),
  );
  // From the capture sheet this stays parentless: `dialogParent` will not hang a sheet off it.
  // The hold keeps the sheet from hiding as the dialog takes its focus.
  handleFrom("assets:chooseFolder", (sender, defaultPath) =>
    whileCaptureDialogOpen(() =>
      chooseFolder(sender, {
        title: "Where are these images relative to?",
        properties: ["openDirectory"],
        defaultPath: defaultPath ?? join(homedir(), "Documents"),
      }),
    ),
  );
  handle("capture:readClipboard", () => readClipboard());
  handle("capture:hide", () => hideCaptureWindow("dismiss"));
  handle("capture:reveal", (path) => {
    // The sheet blurred or was dismissed while "saved" was showing: the user is back in
    // another app, and pulling the main window over it now would be a surprise.
    if (!isCaptureVisible()) return;
    hideCaptureWindow("handoff");
    revealDoc(path);
  });
  handle("capture:resize", (height) => resizeCaptureWindow(height));
  handle("capture:openEditor", (draft) => {
    hideCaptureWindow("handoff");
    openEditorWindow({ draft });
  });

  // ---- windows
  handle("window:openMain", (route) => void openMainWindow(route));
  handle("window:revealDoc", (path, saved) => revealDoc(path, saved));
  handleFrom("window:setEdited", (sender, edited) => {
    if (IS_MAC) sender?.setDocumentEdited(edited);
  });
  // The path travels in the window's hash, which is there before anything has loaded.
  handle("window:openEditor", (p) => void openEditorWindow(p ? { path: p } : {}));
  handleFrom("editor:seed", (sender) => takeEditorSeed(sender));
  handleFrom("editor:setPath", (sender, p) => setEditorPath(sender, p));
}
