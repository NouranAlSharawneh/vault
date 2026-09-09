import type { VaultApi } from '@shared/ipc'

export const api: VaultApi['invoke'] = (channel, ...args) => window.vault.invoke(channel, ...args)
export const on: VaultApi['on'] = (channel, listener) => window.vault.on(channel, listener)
export const searchText = (text: string) => window.vault.search(text)

export const isMac = navigator.platform.toLowerCase().includes('mac')
export const mod = isMac ? '⌘' : 'Ctrl'
export const alt = isMac ? '⌥' : 'Alt'

export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
