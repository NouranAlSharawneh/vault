import { contextBridge, ipcRenderer } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type VaultApi } from '@shared/ipc'

const invokeSet = new Set<string>(INVOKE_CHANNELS)
const eventSet = new Set<string>([...EVENT_CHANNELS, 'navigate'])

const api: VaultApi & { search: (text: string) => Promise<Array<{ path: string; score: number; snippet: string | null }>> } = {
  invoke: (channel, ...args) => {
    if (!invokeSet.has(channel)) return Promise.reject(new Error(`Unknown channel ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel, listener) => {
    if (!eventSet.has(channel)) throw new Error(`Unknown event ${channel}`)
    const wrapped = (_: Electron.IpcRendererEvent, payload: unknown) => listener(payload as never)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  search: (text) => ipcRenderer.invoke('search:query', text),
}

contextBridge.exposeInMainWorld('vault', api)
