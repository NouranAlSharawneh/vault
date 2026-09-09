import { BrowserWindow, screen, shell, app } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

const preload = join(__dirname, '../preload/index.js')
const isMac = process.platform === 'darwin'

function load(win: BrowserWindow, hash: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

const common = {
  webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  show: false,
}

let mainWin: BrowserWindow | null = null
let captureWin: BrowserWindow | null = null
const editorWins = new Set<BrowserWindow>()

export function getMain(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null
}

export function openMain(route = 'main'): BrowserWindow {
  const existing = getMain()
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    existing.webContents.send('navigate', route)
    return existing
  }
  mainWin = new BrowserWindow({
    ...common,
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: 'Vault',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 16 },
    backgroundColor: '#fdfcfa',
    vibrancy: isMac ? 'sidebar' : undefined,
  })
  mainWin.once('ready-to-show', () => mainWin?.show())
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWin.on('closed', () => (mainWin = null))
  load(mainWin, route)
  return mainWin
}

export function openEditor(query = ''): BrowserWindow {
  const win = new BrowserWindow({
    ...common,
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    title: 'New document — Vault',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 16 },
    backgroundColor: '#fdfcfa',
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => editorWins.delete(win))
  editorWins.add(win)
  load(win, `editor${query}`)
  return win
}

/** Frameless sheet that floats over whatever app is in front. Hidden, never destroyed. */
export function getCapture(): BrowserWindow {
  if (captureWin && !captureWin.isDestroyed()) return captureWin
  captureWin = new BrowserWindow({
    ...common,
    width: 720,
    height: 520,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    transparent: isMac,
    backgroundColor: isMac ? '#00000000' : '#1e1d1b',
    vibrancy: isMac ? 'hud' : undefined,
    visualEffectState: 'active',
    fullscreenable: false,
  })
  captureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  captureWin.setAlwaysOnTop(true, 'floating')
  captureWin.on('blur', () => {
    if (captureWin?.isVisible() && !captureWin.webContents.isDevToolsOpened()) hideCapture()
  })
  captureWin.on('closed', () => (captureWin = null))
  load(captureWin, 'capture')
  return captureWin
}

export function showCapture(): BrowserWindow {
  const win = getCapture()
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x, y, width, height } = display.workArea
  const [w, h] = win.getSize()
  win.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height * 0.18), false)
  if (isMac) app.dock?.show()
  win.show()
  win.focus()
  return win
}

export function hideCapture(): void {
  const win = captureWin
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.hide()
    if (isMac && !getMain() && editorWins.size === 0) app.hide()
  }
}

export function isCaptureVisible(): boolean {
  return !!captureWin && !captureWin.isDestroyed() && captureWin.isVisible()
}

export function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}

export function anyWindowOpen(): boolean {
  return !!getMain() || editorWins.size > 0
}
