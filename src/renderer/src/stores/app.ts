import { create } from 'zustand'
import type { AuthState, IndexSnapshot, ScanProgress, SyncStatus, VaultConfig } from '@shared/types'
import { api, on } from '@/lib/api'

interface AppState {
  ready: boolean
  auth: AuthState
  config: VaultConfig | null
  index: IndexSnapshot | null
  progress: ScanProgress
  sync: SyncStatus | null
  platform: string
  boot: () => Promise<void>
  refreshIndex: () => Promise<void>
  setConfig: (c: VaultConfig | null) => void
}

const EMPTY_PROGRESS: ScanProgress = { phase: 'idle', done: 0, total: 0 }

export const useApp = create<AppState>((set) => ({
  ready: false,
  auth: { status: 'signed-out', user: null, method: null },
  config: null,
  index: null,
  progress: EMPTY_PROGRESS,
  sync: null,
  platform: 'darwin',
  boot: async () => {
    const [auth, config, platform] = await Promise.all([api('auth:state'), api('vault:config'), api('app:platform')])
    let index: IndexSnapshot | null = null
    let sync: SyncStatus | null = null
    if (config) {
      try {
        ;[index, sync] = await Promise.all([api('vault:index'), api('sync:status')])
      } catch {
        /* vault not open yet */
      }
    }
    set({ auth, config, index, sync, platform, ready: true })
  },
  refreshIndex: async () => {
    const index = await api('vault:index')
    set({ index })
  },
  setConfig: (config) => set({ config }),
}))

// Subscribe once to main-process pushes.
let subscribed = false
export function subscribeToMain(): void {
  if (subscribed) return
  subscribed = true
  on('index:changed', (index) => useApp.setState({ index }))
  on('index:progress', (progress) => useApp.setState({ progress }))
  on('sync:status', (sync) => useApp.setState({ sync }))
  on('auth:state', (auth) => useApp.setState({ auth }))
}
