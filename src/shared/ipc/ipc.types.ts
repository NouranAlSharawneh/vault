import type {
  AuthMethods,
  AuthState,
  ClipboardCapture,
  CommitInfo,
  ConflictChoice,
  ConflictFile,
  DeviceCodeSession,
  DevicePollStatus,
  DocContent,
  DocMeta,
  EditorDraft,
  GitHubRepo,
  GitHubUser,
  IndexSnapshot,
  SaveRequest,
  SaveResult,
  SavedView,
  ScanProgress,
  SearchHit,
  SyncStatus,
  Template,
  VaultConfig,
  WebFlowStatus,
} from "../types";

/**
 * Request/response IPC contract. Each key is a channel; the value is
 * `(args) => result`. The preload builds `window.vault` from this shape.
 */
export interface IpcInvoke {
  "auth:state": () => AuthState;
  "auth:signInWithToken": (token: string) => GitHubUser;
  "auth:deviceStart": () => DeviceCodeSession;
  "auth:deviceCancel": () => void;
  "auth:deviceAvailable": () => boolean;
  "auth:methods": () => AuthMethods;
  "auth:webStart": () => void;
  "auth:webCancel": () => void;
  "auth:signOut": () => void;

  "github:listRepos": () => GitHubRepo[];
  "github:createRepo": (name: string, isPrivate: boolean) => GitHubRepo;
  "github:openInBrowser": (path?: string) => void;

  "vault:config": () => VaultConfig | null;
  "vault:setup": (opts: { repo: GitHubRepo | null; localPath: string }) => VaultConfig;
  "vault:chooseFolder": () => string | null;
  "vault:defaultPath": (name: string) => string;
  "vault:rescan": () => IndexSnapshot;
  "vault:index": () => IndexSnapshot;
  "vault:updateConfig": (patch: Partial<VaultConfig>) => VaultConfig;
  "vault:disconnect": () => void;
  "vault:revealInFinder": (path?: string) => void;

  "doc:read": (path: string) => DocContent;
  "doc:save": (req: SaveRequest) => SaveResult;
  "doc:trash": (path: string) => void;
  "doc:setStarred": (path: string, starred: boolean) => DocMeta;
  "doc:history": (path: string) => CommitInfo[];
  "doc:atCommit": (path: string, sha: string) => string;
  "doc:restore": (path: string, sha: string) => SaveResult;
  "doc:pathPreview": (project: string, title: string) => string;

  "project:rename": (from: string, to: string) => { moved: number };
  "project:list": () => string[];

  "sync:status": () => SyncStatus;
  "sync:pushNow": () => SyncStatus;
  "sync:pull": () => { conflicts: ConflictFile[] };
  "sync:resolveConflict": (path: string, choice: ConflictChoice) => void;

  "views:list": () => SavedView[];
  "views:save": (view: SavedView) => SavedView[];
  "views:delete": (name: string) => SavedView[];
  "templates:list": () => Template[];

  "search:query": (text: string) => SearchHit[];

  "capture:readClipboard": () => ClipboardCapture;
  "capture:hide": () => void;
  "capture:openEditor": (draft: EditorDraft) => void;

  "window:openMain": (route?: string) => void;
  "window:openEditor": (path?: string) => void;
  "app:version": () => string;
  "app:platform": () => NodeJS.Platform;
}

/** Main → renderer push events. */
export interface IpcEvents {
  "index:changed": IndexSnapshot;
  "index:progress": ScanProgress;
  "sync:status": SyncStatus;
  "auth:state": AuthState;
  "auth:deviceStatus": { status: DevicePollStatus };
  "auth:webStatus": { status: WebFlowStatus; message?: string };
  "capture:shown": ClipboardCapture;
  "editor:open": { path?: string; draft?: EditorDraft };
  shortcut: "search" | "new" | "toggleSidebar" | "history" | "save";
  navigate: string;
}

export type InvokeChannel = keyof IpcInvoke;
export type EventChannel = keyof IpcEvents;

/** The API surface exposed on `window.vault`. */
export interface VaultApi {
  invoke: <C extends InvokeChannel>(
    channel: C,
    ...args: Parameters<IpcInvoke[C]>
  ) => Promise<ReturnType<IpcInvoke[C]>>;
  on: <C extends EventChannel>(channel: C, listener: (payload: IpcEvents[C]) => void) => () => void;
}
