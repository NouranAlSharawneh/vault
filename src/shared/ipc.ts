import type {
  AuthState,
  ClipboardCapture,
  CommitInfo,
  ConflictFile,
  DeviceCodeSession,
  DocContent,
  DocMeta,
  GitHubRepo,
  GitHubUser,
  IndexSnapshot,
  SaveRequest,
  SaveResult,
  SavedView,
  ScanProgress,
  SyncStatus,
  Template,
  VaultConfig,
} from './types'

/**
 * Request/response IPC contract. Each key is a channel name; the value is
 * `(args) => result`. The preload builds `window.vault` from this shape.
 */
export interface IpcInvoke {
  // auth
  'auth:state': () => AuthState
  'auth:signInWithToken': (token: string) => GitHubUser
  'auth:deviceStart': () => DeviceCodeSession
  'auth:deviceCancel': () => void
  'auth:deviceAvailable': () => boolean
  'auth:signOut': () => void

  // github
  'github:listRepos': () => GitHubRepo[]
  'github:createRepo': (name: string, isPrivate: boolean) => GitHubRepo
  'github:openInBrowser': (path?: string) => void

  // vault lifecycle
  'vault:config': () => VaultConfig | null
  'vault:setup': (opts: { repo: GitHubRepo | null; localPath: string }) => VaultConfig
  'vault:chooseFolder': () => string | null
  'vault:defaultPath': (name: string) => string
  'vault:rescan': () => IndexSnapshot
  'vault:index': () => IndexSnapshot
  'vault:updateConfig': (patch: Partial<VaultConfig>) => VaultConfig
  'vault:disconnect': () => void
  'vault:revealInFinder': (path?: string) => void

  // docs
  'doc:read': (path: string) => DocContent
  'doc:save': (req: SaveRequest) => SaveResult
  'doc:trash': (path: string) => void
  'doc:setStarred': (path: string, starred: boolean) => DocMeta
  'doc:history': (path: string) => CommitInfo[]
  'doc:atCommit': (path: string, sha: string) => string
  'doc:restore': (path: string, sha: string) => SaveResult
  'doc:pathPreview': (project: string, title: string) => string

  // projects
  'project:rename': (from: string, to: string) => { moved: number }
  'project:list': () => string[]

  // sync
  'sync:status': () => SyncStatus
  'sync:pushNow': () => SyncStatus
  'sync:pull': () => { conflicts: ConflictFile[] }
  'sync:resolveConflict': (path: string, choice: 'mine' | 'theirs' | 'both') => void

  // views / templates
  'views:list': () => SavedView[]
  'views:save': (view: SavedView) => SavedView[]
  'views:delete': (name: string) => SavedView[]
  'templates:list': () => Template[]

  // capture
  'capture:readClipboard': () => ClipboardCapture
  'capture:hide': () => void
  'capture:openEditor': (draft: { body: string; frontmatter?: Partial<DocMeta> }) => void

  // window
  'window:openMain': (route?: string) => void
  'window:openEditor': (path?: string) => void
  'app:version': () => string
  'app:platform': () => NodeJS.Platform
}

/** Main → renderer push events. */
export interface IpcEvents {
  'index:changed': IndexSnapshot
  'index:progress': ScanProgress
  'sync:status': SyncStatus
  'auth:state': AuthState
  'auth:deviceStatus': { status: 'pending' | 'slow_down' | 'expired' | 'denied' | 'ok' }
  'capture:shown': ClipboardCapture
  'editor:open': { path?: string; draft?: { body: string; frontmatter?: Partial<DocMeta> } }
  'shortcut': 'search' | 'new' | 'toggleSidebar' | 'history' | 'save'
}

export type InvokeChannel = keyof IpcInvoke
export type EventChannel = keyof IpcEvents

export const INVOKE_CHANNELS: InvokeChannel[] = [
  'auth:state', 'auth:signInWithToken', 'auth:deviceStart', 'auth:deviceCancel', 'auth:deviceAvailable', 'auth:signOut',
  'github:listRepos', 'github:createRepo', 'github:openInBrowser',
  'vault:config', 'vault:setup', 'vault:chooseFolder', 'vault:defaultPath', 'vault:rescan', 'vault:index', 'vault:updateConfig', 'vault:disconnect', 'vault:revealInFinder',
  'doc:read', 'doc:save', 'doc:trash', 'doc:setStarred', 'doc:history', 'doc:atCommit', 'doc:restore', 'doc:pathPreview',
  'project:rename', 'project:list',
  'sync:status', 'sync:pushNow', 'sync:pull', 'sync:resolveConflict',
  'views:list', 'views:save', 'views:delete', 'templates:list',
  'capture:readClipboard', 'capture:hide', 'capture:openEditor',
  'window:openMain', 'window:openEditor', 'app:version', 'app:platform',
]

export const EVENT_CHANNELS: EventChannel[] = [
  'index:changed', 'index:progress', 'sync:status', 'auth:state', 'auth:deviceStatus', 'capture:shown', 'editor:open', 'shortcut',
]

/** The API surface exposed on `window.vault`. */
export type VaultApi = {
  invoke: <C extends InvokeChannel>(
    channel: C,
    ...args: Parameters<IpcInvoke[C]>
  ) => Promise<ReturnType<IpcInvoke[C]>>
  on: <C extends EventChannel>(channel: C, listener: (payload: IpcEvents[C]) => void) => () => void
}
