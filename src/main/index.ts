import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray, nativeTheme } from 'electron'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import type { IpcInvoke, IpcEvents, InvokeChannel } from '@shared/ipc'
import type { AuthState, GitHubUser, VaultConfig } from '@shared/types'
import { getSettings, updateSettings, saveToken, loadToken, clearToken, userDataDir } from './store'
import { createRepo, fetchUser, listRepos, openOnGitHub, pollDeviceFlow, startDeviceFlow, GitHubError } from './github'
import { VaultGit } from './git'
import { Vault } from './vault'
import { readClipboard } from './capture'
import { anyWindowOpen, broadcast, getCapture, hideCapture, isCaptureVisible, openEditor, openMain, showCapture } from './windows'

const isMac = process.platform === 'darwin'
let vault: Vault | null = null
let auth: AuthState = { status: 'signed-out', user: null, method: null }
let deviceAbort: AbortController | null = null
let tray: Tray | null = null

// ---- helpers ------------------------------------------------------------------

function emit<C extends keyof IpcEvents>(channel: C, payload: IpcEvents[C]): void {
  broadcast(channel, payload)
}

function handle<C extends InvokeChannel>(channel: C, fn: (...args: Parameters<IpcInvoke[C]>) => ReturnType<IpcInvoke[C]> | Promise<ReturnType<IpcInvoke[C]>>): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...(args as Parameters<IpcInvoke[C]>))
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err instanceof GitHubError && err.status === 401) setAuth({ status: 'expired', user: auth.user, method: auth.method })
      throw new Error(err.message ?? String(e))
    }
  })
}

function setAuth(next: AuthState): void {
  auth = next
  emit('auth:state', auth)
  updateTray()
}

function requireVault(): Vault {
  if (!vault) throw new Error('No vault is open')
  return vault
}

function requireToken(): string {
  const t = loadToken()
  if (!t) throw new GitHubError('Not signed in', 401)
  return t
}

async function signIn(token: string, method: 'pat' | 'device'): Promise<GitHubUser> {
  const user = await fetchUser(token)
  saveToken(token)
  updateSettings({ authMethod: method })
  setAuth({ status: 'signed-in', user, method })
  return user
}

async function openVault(config: VaultConfig): Promise<void> {
  await vault?.close()
  vault = new Vault(config, userDataDir(), () => loadToken())
  vault.on('index', (s) => emit('index:changed', s))
  vault.on('progress', (p) => emit('index:progress', p))
  vault.on('sync', (s) => {
    emit('sync:status', s)
    updateTray()
  })
  vault.on('auth-expired', () => setAuth({ status: 'expired', user: auth.user, method: auth.method }))
  await vault.open()
}

async function restoreSession(): Promise<void> {
  const token = loadToken()
  const s = getSettings()
  if (token) {
    try {
      const user = await fetchUser(token)
      auth = { status: 'signed-in', user, method: s.authMethod ?? 'pat' }
    } catch (e) {
      auth = { status: (e as GitHubError).status === 401 ? 'expired' : 'signed-in', user: null, method: s.authMethod }
    }
  }
  if (s.vault && existsSync(s.vault.root)) {
    try {
      await openVault(s.vault)
    } catch (e) {
      console.error('Failed to open vault', e)
    }
  }
}

// ---- IPC ---------------------------------------------------------------------------

function registerIpc(): void {
  handle('app:version', () => app.getVersion())
  handle('app:platform', () => process.platform)

  handle('auth:state', () => auth)
  handle('auth:signInWithToken', (token) => signIn(token.trim(), 'pat'))
  handle('auth:deviceAvailable', () => !!(process.env.VAULT_GITHUB_CLIENT_ID || getSettings().githubClientId))
  handle('auth:deviceStart', async () => {
    const clientId = process.env.VAULT_GITHUB_CLIENT_ID || getSettings().githubClientId
    if (!clientId) throw new Error('No GitHub OAuth client ID configured. Paste a token instead.')
    deviceAbort?.abort()
    deviceAbort = new AbortController()
    const session = await startDeviceFlow(clientId)
    void shell.openExternal(session.verificationUri)
    const signal = deviceAbort.signal
    void pollDeviceFlow(clientId, session.deviceCode, session.interval, signal, (status) => emit('auth:deviceStatus', { status }))
      .then((token) => signIn(token, 'device'))
      .catch((e) => {
        if (!signal.aborted) console.warn('device flow failed', e)
      })
    const { deviceCode: _dc, ...pub } = session
    return pub
  })
  handle('auth:deviceCancel', () => deviceAbort?.abort())
  handle('auth:signOut', () => {
    clearToken()
    setAuth({ status: 'signed-out', user: null, method: null })
  })

  handle('github:listRepos', () => listRepos(requireToken()))
  handle('github:createRepo', (name, isPrivate) => createRepo(requireToken(), name, isPrivate))
  handle('github:openInBrowser', (path) => openOnGitHub(path ?? (vault?.config.remote ?? '')))

  handle('vault:config', () => getSettings().vault)
  handle('vault:defaultPath', (name) => join(homedir(), 'Documents', name))
  handle('vault:chooseFolder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], defaultPath: join(homedir(), 'Documents') })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('vault:setup', async ({ repo, localPath }) => {
    const gitVersion = await VaultGit.isAvailable()
    if (!gitVersion) throw new Error('git is not installed. On macOS run `xcode-select --install` and try again.')
    const config: VaultConfig = {
      root: localPath,
      remote: repo?.fullName ?? null,
      branch: repo?.defaultBranch ?? 'main',
      lastProject: null,
      lastSource: 'claude',
      hotkey: 'Alt+Space',
      pushDebounceMs: 3000,
    }
    if (repo && !existsSync(join(localPath, '.git'))) {
      try {
        await VaultGit.clone(repo.cloneUrl, localPath, loadToken(), repo.defaultBranch)
      } catch (e) {
        // Empty repo → clone fails; init locally and set the remote.
        if (!/empty|warning: You appear to have cloned an empty repository/i.test(String(e))) {
          await VaultGit.init(localPath, config.branch)
        }
      }
    }
    if (!existsSync(join(localPath, '.git'))) await VaultGit.init(localPath, config.branch)
    updateSettings({ vault: config, onboarded: true })
    await openVault(config)
    if (repo) {
      await vault!.git.setRemote(repo.cloneUrl)
      vault!.schedulePush()
    }
    registerHotkey(config.hotkey)
    return config
  })
  handle('vault:updateConfig', async (patch) => {
    const cur = getSettings().vault
    if (!cur) throw new Error('No vault')
    const next = { ...cur, ...patch }
    updateSettings({ vault: next })
    if (vault) Object.assign(vault.config, next)
    if (patch.hotkey) registerHotkey(next.hotkey)
    return next
  })
  handle('vault:index', () => requireVault().index.snapshot())
  handle('vault:rescan', () => requireVault().index.rescan())
  handle('vault:disconnect', async () => {
    await vault?.disconnect()
    vault = null
    updateSettings({ vault: null, onboarded: false })
  })
  handle('vault:revealInFinder', (p) => shell.showItemInFolder(join(requireVault().root, p ?? '')))

  handle('doc:read', (p) => requireVault().read(p))
  handle('doc:save', async (req) => {
    const v = requireVault()
    const res = await v.save(req)
    const patch: Partial<VaultConfig> = { lastProject: req.frontmatter.project || null, lastSource: req.frontmatter.source }
    Object.assign(v.config, patch)
    updateSettings({ vault: v.config })
    return res
  })
  handle('doc:trash', (p) => requireVault().trash(p))
  handle('doc:setStarred', (p, s) => requireVault().setStarred(p, s))
  handle('doc:history', (p) => requireVault().history(p))
  handle('doc:atCommit', (p, sha) => requireVault().atCommit(p, sha))
  handle('doc:restore', (p, sha) => requireVault().restore(p, sha))
  handle('doc:pathPreview', (project, title) => requireVault().previewPath(project, title))

  handle('project:rename', (from, to) => requireVault().renameProject(from, to))
  handle('project:list', () => requireVault().projects())

  handle('sync:status', () => requireVault().status())
  handle('sync:pushNow', () => requireVault().pushNow())
  handle('sync:pull', () => requireVault().pull())
  handle('sync:resolveConflict', (p, c) => requireVault().resolveConflict(p, c))

  handle('views:list', () => requireVault().listViews())
  handle('views:save', (v) => requireVault().saveView(v))
  handle('views:delete', (n) => requireVault().deleteView(n))
  handle('templates:list', () => requireVault().listTemplates())

  handle('capture:readClipboard', () => readClipboard())
  handle('capture:hide', () => hideCapture())
  handle('capture:openEditor', (draft) => {
    hideCapture()
    const win = openEditor()
    win.webContents.once('did-finish-load', () => win.webContents.send('editor:open', { draft }))
  })

  handle('window:openMain', (route) => void openMain(route))
  handle('window:openEditor', (p) => {
    const win = openEditor(p ? `?path=${encodeURIComponent(p)}` : '')
    if (p) win.webContents.once('did-finish-load', () => win.webContents.send('editor:open', { path: p }))
  })

  // Search runs in main against the in-memory index.
  ipcMain.handle('search:query', (_e, text: string) => (vault ? vault.search(text) : []))
}

// ---- hotkey, tray, menu ---------------------------------------------------------

function toggleCapture(): void {
  if (isCaptureVisible()) return hideCapture()
  if (!vault) return void openMain('onboarding')
  const win = showCapture()
  void readClipboard().then((payload) => {
    const send = () => win.webContents.send('capture:shown', payload)
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  })
}

function registerHotkey(accel: string): void {
  globalShortcut.unregisterAll()
  try {
    if (!globalShortcut.register(accel, toggleCapture)) console.warn('Hotkey unavailable:', accel)
  } catch (e) {
    console.warn('Hotkey failed', e)
  }
}

function trayIcon(): Electron.NativeImage {
  const svg = (color: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="11" cy="20" r="6" fill="${color}"/><circle cx="21" cy="20" r="6" fill="${color}"/></svg>`
  const img = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg('#000000')).toString('base64'))
  const resized = img.resize({ width: 16, height: 16 })
  resized.setTemplateImage(true)
  return resized
}

function updateTray(): void {
  if (!tray) return
  const s = vault?.status()
  const state = s?.state ?? 'synced'
  const label = state === 'synced' ? 'All pushed' : state === 'pending' ? `${s?.ahead ?? 0} commit(s) waiting` : state === 'pushing' ? 'Pushing…' : state === 'offline' ? 'Offline — will retry' : state === 'conflict' ? 'Conflict needs attention' : s?.lastError ?? 'Sync error'
  tray.setToolTip(`Vault — ${label}`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Vault${auth.user ? ` · ${auth.user.login}` : ''}`, enabled: false },
      { label: label, enabled: false },
      { type: 'separator' },
      { label: 'Capture from clipboard', accelerator: 'Alt+Space', click: toggleCapture },
      { label: 'Open Vault', accelerator: 'CmdOrCtrl+Shift+V', click: () => openMain() },
      { label: 'New document', click: () => openEditor() },
      { type: 'separator' },
      { label: 'Push now', enabled: !!vault?.config.remote, click: () => void vault?.pushNow() },
      { label: 'Rescan vault folder', enabled: !!vault, click: () => void vault?.index.rescan() },
      { label: 'Open on GitHub', enabled: !!vault?.config.remote, click: () => openOnGitHub(vault?.config.remote ?? '') },
      { type: 'separator' },
      { label: 'Quit Vault', role: 'quit' },
    ]),
  )
}

function buildMenu(): void {
  const send = (s: IpcEvents['shortcut']) => () => {
    const w = BrowserWindow.getFocusedWindow()
    w?.webContents.send('shortcut', s)
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: () => openEditor() },
        { label: 'Capture from Clipboard', accelerator: 'Alt+Space', click: toggleCapture },
        { label: 'Save', accelerator: 'CmdOrCtrl+Enter', click: send('save') },
        { type: 'separator' },
        { label: 'Open Vault Window', accelerator: 'CmdOrCtrl+Shift+V', click: () => openMain() },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Search…', accelerator: 'CmdOrCtrl+K', click: send('search') },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: send('toggleSidebar') },
        { label: 'History', accelerator: 'CmdOrCtrl+Y', click: send('history') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'Vault on GitHub', click: () => openOnGitHub('nunu/vault') }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---- lifecycle -------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

app.on('second-instance', () => openMain())

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('dev.nunu.vault')
  nativeTheme.themeSource = 'light'
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  registerIpc()
  buildMenu()
  await restoreSession()
  tray = new Tray(trayIcon())
  updateTray()
  tray.on('click', () => (isMac ? tray?.popUpContextMenu() : openMain()))
  const s = getSettings()
  if (s.vault && vault) registerHotkey(s.vault.hotkey)
  getCapture() // pre-warm so the sheet appears instantly
  openMain(s.onboarded && vault ? 'main' : 'onboarding')
  app.on('activate', () => {
    if (!anyWindowOpen()) openMain()
  })
})

app.on('window-all-closed', () => {
  // Stay alive in the menu bar for the global hotkey.
  if (!isMac) app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  void vault?.close()
})
