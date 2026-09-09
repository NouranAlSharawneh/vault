import type { VaultApi } from '../shared/ipc'

declare global {
  interface Window {
    vault: VaultApi & { search: (text: string) => Promise<Array<{ path: string; score: number; snippet: string | null }>> }
  }
}
export {}
