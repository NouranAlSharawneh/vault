import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } from "electron";
import { DEFAULT_HOTKEY } from "@shared/constants";
import type { InvokeChannel, IpcInvoke } from "@shared/ipc";
import type { DevicePollStatus } from "@shared/types";
import { APP_REPO, appMenu } from "../../data/menu.data";
import { fire } from "../../lib/fire";
import {
  createRepo,
  listRepos,
  openOnGitHub,
  pollDeviceFlow,
  startDeviceFlow,
} from "../../network/github";
import { resolveAssets, stageImage } from "../../services/assets";
import { readClipboard } from "../../services/capture/capture.service";
import { notifyCaptureSaved } from "../../services/capture/notify-saved";
import { icloudWarning } from "../../services/fs/icloud";
import {
  currentGitStatus,
  installGitTools,
  onGitStatus,
  refreshGitStatus,
} from "../../services/git/git-status.service";
import { checkForUpdates } from "../../services/updates/check-for-updates";
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
  takeReveal,
  notifyDocGone,
  setEditorPath,
  takeEditorSeed,
  whileCaptureDialogOpen,
  isAppUrl,
  isSafeExternal,
} from "../../windows";
import { collectDiagnostics } from "../diagnostics/collect-diagnostics";
import { hotkeyStatus, registerHotkey } from "../hotkey/hotkey";
import { loginItemState, setLoginItem } from "../login-item/login-item";
import { buildAppMenu } from "../menu/menu";
import { openMarkdownFile } from "../open-file/open-file";
import { resetApp } from "../session/reset-app";
import { session } from "../session/session";
import { nudgeSync } from "../session/sync-watch";
import { shortcutGroups } from "../shortcuts/shortcut-groups";
import { sanitizeConfigPatch } from "./config-patch";
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
    // Only the app's own page speaks to main. Anything a window was navigated to still
    // carries the preload, so the bridge alone proves nothing about who is calling.
    if (!isAppUrl(event.senderFrame?.url ?? "")) throw new Error("Not allowed");
    try {
      const sender = BrowserWindow.fromWebContents(event.sender);

      return await fn(sender, ...(args as Parameters<IpcInvoke[C]>));
    } catch (e) {
      // A 401 is not marked "signed out" here. The network layer already asks the session
      // to check — which refreshes a token that can be refreshed — and marking it first
      // flashed the banner for those, and turned a mistyped token at sign-in into an
      // "expired" session for someone who had never signed in.
      throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
    }
  });
}

/** An open dialog (folder or file), as a sheet on the window that asked when there is one. */
async function pickPath(
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
  handle("app:checkForUpdates", () => checkForUpdates(APP_REPO, app.getVersion()));
  handle("app:platform", () => process.platform);
  handle("app:loginItem", () => loginItemState());
  handle("app:setLoginItem", (open) => setLoginItem(open));
  handle("app:copyDiagnostics", async () => {
    const text = await collectDiagnostics();
    await clipboard.writeText(text);

    return text;
  });
  handle("app:shortcuts", () =>
    shortcutGroups(
      appMenu(getSettings().vault?.hotkey ?? DEFAULT_HOTKEY, { mac: IS_MAC, dev: false }),
    ),
  );
  handle("file:open", (path) => openMarkdownFile(path));
  handle("hotkey:status", () => hotkeyStatus());
  handle("app:openExternal", async (url) => {
    // Web pages and mail drafts only: anything else (file:, custom schemes) could launch
    // an arbitrary app from a link in a pasted document. Said, not ignored, so the caller's
    // "couldn't open" reaches the user.
    if (!isSafeExternal(url)) throw new Error("Only web and mail links open from Marasca");
    await shell.openExternal(url);
  });

  // ---- auth
  handle("auth:state", () => session.auth);
  handle("auth:signInWithToken", (token) =>
    session.signIn(
      { accessToken: token.trim(), refreshToken: null, expiresAt: null, refreshExpiresAt: null },
      "pat",
    ),
  );
  handle("auth:methods", () => ({ device: !!getOAuthConfig() }));
  handle("auth:deviceStart", async () => {
    const clientId = getOAuthConfig()?.clientId;
    if (!clientId) throw new Error("No GitHub OAuth client ID configured. Paste a token instead.");
    // This attempt's own controller, held before the wait. Read after it, a Cancel and a
    // new start in between left this attempt polling on the new one's signal — a second
    // browser tab, and a stray "expired" fifteen minutes later.
    deviceAbort?.abort();
    const controller = new AbortController();
    deviceAbort = controller;
    const { signal } = controller;
    const { deviceCode, ...publicSession } = await startDeviceFlow(clientId);
    if (signal.aborted) throw new Error("Cancelled");
    fire(shell.openExternal(publicSession.verificationUri), "opening GitHub");
    const say = (status: DevicePollStatus) => {
      if (!signal.aborted) broadcast("auth:deviceStatus", { status });
    };
    void pollDeviceFlow(clientId, deviceCode, publicSession.interval, signal, say)
      .then((token) =>
        // The poller reports its own ends. Signing in after "Approved!" did not, so a
        // failed user lookup left the card on "Approved!" with nothing ever happening.
        session.signIn(token, "device").catch((e: unknown) => {
          say("error");
          throw e;
        }),
      )
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
      canRefresh: !!creds?.refreshToken && !!getOAuthConfig(),
    };
  });

  // ---- github
  handle("github:listRepos", () => listRepos());
  handle("github:createRepo", (name, isPrivate) => createRepo(name, isPrivate));
  handle("github:openInBrowser", (path) =>
    openOnGitHub(path ?? session.vault?.config.remote ?? ""),
  );

  // ---- git
  onGitStatus((status) => broadcast("git:status", status));
  handle("git:status", () => currentGitStatus());
  handle("git:recheck", () => refreshGitStatus());
  handle("git:installTools", () => installGitTools());
  handleFrom("git:choosePath", async (sender) => {
    const path = await pickPath(sender, {
      title: "Choose the git Marasca should use",
      properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory"],
      defaultPath: "/usr/local/bin",
    });
    if (!path) return null;
    updateSettings({ gitPath: path });

    return refreshGitStatus();
  });
  handle("git:clearPath", () => {
    updateSettings({ gitPath: null });

    return refreshGitStatus();
  });

  // ---- vault lifecycle
  handle("vault:config", () => getSettings().vault);
  handle("vault:defaultPath", (name) => join(homedir(), "Documents", name));
  handleFrom("vault:chooseFolder", (sender) =>
    pickPath(sender, {
      properties: ["openDirectory", "createDirectory"],
      defaultPath: join(homedir(), "Documents"),
    }),
  );
  handle("vault:setup", async ({ repo, localPath }) => {
    const config = await setupVault(session, repo, localPath);
    registerHotkey(config.hotkey);

    return config;
  });
  handle("vault:updateConfig", (raw) => {
    const current = getSettings().vault;
    if (!current) throw new Error("No vault");
    const patch = sanitizeConfigPatch(raw);
    const next = { ...current, ...patch };
    // The same shortcut again is a retry: another app may have let go of it since. Only
    // a different one used to be registered, so "not active" stuck until a relaunch.
    const retry = patch.hotkey === current.hotkey && !hotkeyStatus().active;
    if (
      patch.hotkey &&
      (patch.hotkey !== current.hotkey || retry) &&
      !registerHotkey(patch.hotkey)
    ) {
      if (!retry) registerHotkey(current.hotkey);
      throw new Error("That shortcut is taken by another app, or macOS won’t allow it.");
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
    // Finder does nothing at all for a path that isn't there, which is exactly when this
    // is pressed from "couldn't open the vault". Say so instead.
    const target = join(root, p ?? "");
    if (!existsSync(target)) throw new Error(`${target} isn’t there any more`);
    shell.showItemInFolder(target);
  });
  handle("vault:folderWarning", (path) => icloudWarning(path));
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
    // Only something new says what to suggest next time. Re-saving an old document from
    // another project used to change the capture sheet's default to that project.
    if (!req.existingPath) {
      Object.assign(vault.config, {
        lastProject: req.frontmatter.project || null,
        lastSource: req.frontmatter.source,
      });
      updateSettings({ vault: vault.config });
    }

    return res;
  });
  handle("doc:trash", async (p) => {
    const trashed = await session.requireVault().trash(p);
    notifyDocGone(p);

    return trashed;
  });
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
  handle("doc:pathPreview", (project, title, existingPath) =>
    session.requireVault().previewPath(project, title, existingPath),
  );

  // ---- projects
  handle("project:rename", (from, to) => session.requireVault().renameProject(from, to));
  handle("project:list", () => session.requireVault().projects());

  // ---- sync
  handle("sync:status", () => session.requireVault().status());
  handle("sync:pushNow", () => session.requireVault().pushNow());
  handle("sync:pull", () => session.requireVault().pull());
  handle("sync:nudge", () => nudgeSync());
  handle("conflicts:list", () => session.requireVault().conflicts());
  handle("conflicts:resolve", (p, choice) => session.requireVault().resolveConflict(p, choice));

  // ---- views / templates / search
  handle("views:list", () => session.requireVault().listViews());
  handle("views:save", (v) => session.requireVault().saveView(v));
  handle("views:delete", (n) => session.requireVault().deleteView(n));
  handle("templates:list", () => session.requireVault().listTemplates());
  handle("search:query", (text, filters) => session.vault?.search(text, filters) ?? []);

  // ---- capture
  handle("assets:resolve", (baseDir, refs) =>
    resolveAssets(baseDir, refs, Object.values(getSettings().vault?.assetDirs ?? {})),
  );
  // From the capture sheet this stays parentless: `dialogParent` will not hang a sheet off it.
  // The hold keeps the sheet from hiding as the dialog takes its focus.
  handleFrom("assets:chooseFolder", (sender, defaultPath) =>
    whileCaptureDialogOpen(() =>
      pickPath(sender, {
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
  handle("capture:saved", (path, title) => {
    const notified = notifyCaptureSaved(path, title, {
      Notification,
      open: (p) => revealDoc(p),
      undo: async (p) => {
        await session.requireVault().trash(p);
        notifyDocGone(p);
      },
    });
    // Gone at once, focus back where the clip came from; the notification carries the
    // news, and Open and Undo. Without notifications, the sheet flashes it as before.
    if (notified) hideCaptureWindow("dismiss");

    return notified;
  });
  handle("capture:resize", (height) => resizeCaptureWindow(height));
  handle("capture:openEditor", (draft) => {
    hideCaptureWindow("handoff");
    openEditorWindow({ draft });
  });

  // ---- windows
  handle("window:openMain", (route) => void openMainWindow(route));
  handle("window:revealDoc", (path, saved) => revealDoc(path, saved));
  handle("window:takeReveal", () => takeReveal());
  handleFrom("window:setEdited", (sender, edited) => {
    if (IS_MAC) sender?.setDocumentEdited(edited);
  });
  // The path travels in the window's hash, which is there before anything has loaded.
  handle("window:openEditor", (p) => void openEditorWindow(p ? { path: p } : {}));
  handleFrom("editor:seed", (sender) => takeEditorSeed(sender));
  handleFrom("editor:setPath", (sender, p) => setEditorPath(sender, p));
  handle("editor:stageImage", (name, bytes) => stageImage(name, bytes));
}
