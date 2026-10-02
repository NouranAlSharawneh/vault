import type {
  AssetResolution,
  AuthMethods,
  AuthState,
  ClipboardCapture,
  CommitInfo,
  ConflictChoice,
  ConflictPair,
  DeviceCodeSession,
  DevicePollStatus,
  DocContent,
  DocReveal,
  DocMeta,
  EditorDraft,
  SavedNotice,
  GitHubRepo,
  GitStatus,
  GitHubUser,
  PullResult,
  HotkeyStatus,
  IndexSnapshot,
  LoginItemState,
  SaveRequest,
  SaveResult,
  SavedView,
  ScanProgress,
  SearchHit,
  ShortcutGroup,
  StoredDraft,
  SyncStatus,
  TokenStatus,
  Template,
  TrashedDoc,
  UpdateCheck,
  VaultConfig,
} from "../types";

/**
 * Request/response IPC contract. Each key is a channel; the value is
 * `(args) => result`. The preload builds `window.marasca` from this shape.
 */
export interface IpcInvoke {
  "auth:state": () => AuthState;
  "auth:signInWithToken": (token: string) => GitHubUser;
  "auth:deviceStart": () => DeviceCodeSession;
  "auth:deviceCancel": () => void;
  "auth:methods": () => AuthMethods;
  "auth:signOut": () => void;
  /** What the stored credential looks like — never the token itself. */
  "auth:tokenStatus": () => TokenStatus;

  "github:listRepos": () => GitHubRepo[];
  "github:createRepo": (name: string, isPrivate: boolean) => GitHubRepo;
  "github:openInBrowser": (path?: string) => void;

  /** Whether git can run, from the last check (made at launch, then on demand). */
  "git:status": () => GitStatus;
  /** Look for git again, now — after the user installed or fixed it themselves. */
  "git:recheck": () => GitStatus;
  /** Open Apple's Command Line Tools installer; progress arrives on the git:status event. */
  "git:installTools": () => GitStatus;
  /** Pick a git binary by hand. Null when the dialog was cancelled. */
  "git:choosePath": () => GitStatus | null;
  /** Forget a hand-picked git and detect one again. */
  "git:clearPath": () => GitStatus;

  "vault:config": () => VaultConfig | null;
  "vault:setup": (opts: { repo: GitHubRepo | null; localPath: string }) => VaultConfig;
  "vault:chooseFolder": () => string | null;
  "vault:defaultPath": (name: string) => string;
  "vault:rescan": () => IndexSnapshot;
  "vault:index": () => IndexSnapshot;
  "vault:updateConfig": (patch: Partial<VaultConfig>) => VaultConfig;
  "vault:revealInFinder": (path?: string) => void;
  /** Why a folder is a risky home for a vault (iCloud Drive syncing it too), or null. */
  "vault:folderWarning": (path: string) => string | null;
  /** Open the configured vault again after it failed to open at launch. */
  "vault:reopen": () => IndexSnapshot;

  "doc:read": (path: string) => DocContent;
  "doc:save": (req: SaveRequest) => SaveResult;
  "doc:trash": (path: string) => TrashedDoc;
  "doc:setStarred": (path: string, starred: boolean) => DocMeta;
  "doc:history": (path: string) => CommitInfo[];
  "doc:restore": (path: string, sha: string) => SaveResult;
  "doc:diff": (path: string, sha: string) => string;
  "doc:pathPreview": (project: string, title: string, existingPath?: string) => string;

  /** Unsaved editor text, parked outside the vault. `key` is a doc path, or `untitled:<id>`. */
  "draft:save": (key: string, draft: StoredDraft) => void;
  "draft:load": (key: string) => StoredDraft | null;
  "draft:clear": (key: string) => void;

  "trash:list": () => TrashedDoc[];
  "trash:read": (path: string) => DocContent;
  "trash:restore": (path: string) => SaveResult;
  /** One trashed doc, or the whole folder when no path is given. */
  "trash:purge": (path?: string) => { removed: number; assets: string[] };

  "project:rename": (from: string, to: string) => { moved: number };
  "project:list": () => string[];

  "sync:status": () => SyncStatus;
  "sync:pushNow": () => SyncStatus;
  /** Fetch and rebase. Conflicts are kept as pairs, never left in the working tree. */
  "sync:pull": () => PullResult;
  /** The network came back: retry whatever is waiting, once, after a short settle. */
  "sync:nudge": () => void;
  "conflicts:list": () => ConflictPair[];
  /** `copyPath` is the stamped copy; the choice decides what ends up at the original path. */
  "conflicts:resolve": (copyPath: string, choice: ConflictChoice) => void;

  "views:list": () => SavedView[];
  "views:save": (view: SavedView) => SavedView[];
  "views:delete": (name: string) => SavedView[];
  "templates:list": () => Template[];

  /** `filters` is the whole query; its operators narrow the hits before they are ranked and cut. */
  "search:query": (text: string, filters?: string) => SearchHit[];

  "assets:resolve": (baseDir: string | null, refs: string[]) => AssetResolution;
  "assets:chooseFolder": (defaultPath?: string) => string | null;

  "capture:readClipboard": () => ClipboardCapture;
  /**
   * Hide the sheet and open the just-saved document in the main window (⌥⌘↵). A plain ⌘↵
   * save uses `capture:hide` instead, so focus goes back to the app the clip came from.
   * Does nothing once the sheet is already gone: the user has moved on.
   */
  "capture:reveal": (path: string) => void;
  /** Grow or shrink the capture sheet to the height its content actually needs. */
  "capture:resize": (height: number) => void;
  "capture:hide": () => void;
  /**
   * A ⌘↵ save landed: hide the sheet now and say so in a notification, with Open and
   * Undo. False where notifications aren't available; the sheet then says it itself.
   */
  "capture:saved": (path: string, title: string) => boolean;
  "capture:openEditor": (draft: EditorDraft) => void;

  "window:openMain": (route?: string) => void;
  /** Bring the main window forward with this document selected. */
  "window:revealDoc": (path: string, saved?: SavedNotice) => void;
  /**
   * The reveal still waiting for the main window, handed over once. The library asks when
   * it mounts: a `doc:reveal` sent as a closed window reopened arrived before anything
   * was listening, and the saved document came up unselected, with no "Saved" either.
   */
  "window:takeReveal": () => DocReveal | null;
  "window:openEditor": (path?: string) => void;
  /**
   * The text an editor window was opened with (from the capture sheet), handed over once.
   * The window asks for it when it is ready: an event pushed on did-finish-load could
   * arrive before the editor was listening, and the text was lost.
   */
  "editor:seed": () => EditorDraft | null;
  /** The asking editor window now holds this document, so opening it again focuses it. */
  "editor:setPath": (path: string | null) => void;
  /**
   * An image pasted or dropped into the editor: kept in app data until the document is
   * saved, which copies it into the document's `assets/`. Answers the name to link it by.
   */
  "editor:stageImage": (name: string, bytes: Uint8Array) => string;
  /** macOS: mark the sending window as having unsaved changes (the dot in its close button). */
  "window:setEdited": (edited: boolean) => void;
  "app:version": () => string;
  /** Compare this build with the newest published release on GitHub. */
  "app:checkForUpdates": () => UpdateCheck;
  /** The last update check's answer, from the background watch or a check by hand. */
  "app:updateStatus": () => UpdateCheck | null;
  "app:platform": () => NodeJS.Platform;
  /** Whether the capture shortcut is really bound, or another app is holding it. */
  "hotkey:status": () => HotkeyStatus;
  "app:openExternal": (url: string) => void;
  "app:reset": () => void;
  "app:loginItem": () => LoginItemState;
  "app:setLoginItem": (openAtLogin: boolean) => LoginItemState;
  /** What someone helping needs to know, copied to the clipboard; the same text returned. */
  "app:copyDiagnostics": () => string;
  /** Every menu shortcut, grouped as the menus are, with the capture shortcut among them. */
  "app:shortcuts": () => ShortcutGroup[];
  /**
   * A markdown file from outside (dropped on a window): opened in an editor. One in the
   * vault opens as itself; one elsewhere opens as a new document, the original untouched.
   */
  "file:open": (path: string) => void;
}

/** Main → renderer push events. */
/** Named so both the menu and the window keydown that raise it can agree on the list. */
export type Shortcut =
  | "search"
  | "new"
  | "toggleSidebar"
  | "history"
  /** ⌘S: commit and keep the window open. */
  | "save"
  /** ⌘↵: commit and close. */
  | "saveClose"
  | "trash"
  | "settings"
  /** Help ▸ Keyboard Shortcuts. */
  | "shortcuts";

export interface IpcEvents {
  "index:changed": IndexSnapshot;
  "index:progress": ScanProgress;
  "sync:status": SyncStatus;
  /** A check found something different: a new version, or none any more. */
  "app:updateStatus": UpdateCheck;
  "auth:state": AuthState;
  "git:status": GitStatus;
  "auth:deviceStatus": { status: DevicePollStatus };
  "capture:shown": ClipboardCapture;
  /** The sheet went away (Esc, blur, save or the hotkey): drop anything still pending. */
  "capture:hidden": null;
  /** Select this document in the main window, clearing filters if it isn't in the list. */
  "doc:reveal": DocReveal;
  /** The document an editor window holds was moved from under it (to the trash, say). */
  "editor:docGone": { path: string; reason: "trashed" };
  shortcut: Shortcut;
  navigate: string;
}

export type InvokeChannel = keyof IpcInvoke;
export type EventChannel = keyof IpcEvents;

/** The API surface exposed on `window.marasca`. */
export interface MarascaApi {
  invoke: <C extends InvokeChannel>(
    channel: C,
    ...args: Parameters<IpcInvoke[C]>
  ) => Promise<ReturnType<IpcInvoke[C]>>;
  on: <C extends EventChannel>(channel: C, listener: (payload: IpcEvents[C]) => void) => () => void;
  /** Where a dropped file lives on disk (Electron no longer puts it on `File.path`). */
  pathForFile: (file: File) => string;
}
