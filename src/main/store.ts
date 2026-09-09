import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { VaultConfig } from '@shared/types'

/**
 * Tiny JSON settings store in userData. Holds app config only — nothing that
 * belongs in the vault repo. The GitHub token is stored separately, encrypted
 * with Electron's safeStorage (macOS Keychain-backed key).
 */
export function userDataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function configPath(): string {
  return join(userDataDir(), 'config.json')
}

export interface AppSettings {
  vault: VaultConfig | null
  authMethod: 'pat' | 'device' | null
  githubClientId: string | null
  onboarded: boolean
}

const DEFAULTS: AppSettings = { vault: null, authMethod: null, githubClientId: null, onboarded: false }

let cache: AppSettings | null = null

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(readFileSync(configPath(), 'utf8')) }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache!
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  cache = { ...getSettings(), ...patch }
  writeFileSync(configPath(), JSON.stringify(cache, null, 2))
  return cache
}

// ---- secrets -------------------------------------------------------------

function tokenPath(): string {
  return join(userDataDir(), 'github.token')
}

export function saveToken(token: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(tokenPath(), safeStorage.encryptString(token))
  } else {
    // Linux without a keyring, or CI. Still never in the repo.
    writeFileSync(tokenPath(), Buffer.from('plain:' + token), { mode: 0o600 })
  }
}

export function loadToken(): string | null {
  try {
    const buf = readFileSync(tokenPath())
    if (buf.subarray(0, 6).toString() === 'plain:') return buf.subarray(6).toString()
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

export function clearToken(): void {
  try {
    unlinkSync(tokenPath())
  } catch {
    /* already gone */
  }
}
