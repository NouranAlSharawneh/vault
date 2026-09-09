import { shell } from 'electron'
import type { DeviceCodeSession, GitHubRepo, GitHubUser } from '@shared/types'

const API = 'https://api.github.com'

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vault-desktop',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = (await res.json()) as { message?: string }
      if (j.message) msg = j.message
    } catch {
      /* no body */
    }
    throw new GitHubError(msg, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

interface RawUser { login: string; name: string | null; avatar_url: string }
interface RawRepo {
  full_name: string; name: string; private: boolean; default_branch: string; clone_url: string
  pushed_at: string; description: string | null; owner: { login: string }; permissions?: { push?: boolean }
}

const toRepo = (r: RawRepo): GitHubRepo => ({
  fullName: r.full_name, name: r.name, owner: r.owner.login, private: r.private,
  defaultBranch: r.default_branch, cloneUrl: r.clone_url, pushedAt: r.pushed_at, description: r.description,
})

export async function fetchUser(token: string): Promise<GitHubUser> {
  const u = await gh<RawUser>(token, '/user')
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url }
}

/** Repos the token can push to, most recently pushed first. */
export async function listRepos(token: string): Promise<GitHubRepo[]> {
  const out: GitHubRepo[] = []
  for (let page = 1; page <= 5; page++) {
    const batch = await gh<RawRepo[]>(token, `/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator&page=${page}`)
    out.push(...batch.filter((r) => r.permissions?.push !== false).map(toRepo))
    if (batch.length < 100) break
  }
  return out
}

export async function createRepo(token: string, name: string, isPrivate: boolean): Promise<GitHubRepo> {
  const r = await gh<RawRepo>(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: false,
      description: 'Markdown vault — captured with Vault',
    }),
  })
  return toRepo(r)
}

export async function getRepo(token: string, fullName: string): Promise<GitHubRepo> {
  return toRepo(await gh<RawRepo>(token, `/repos/${fullName}`))
}

// ---- OAuth device flow -----------------------------------------------------
// Lights up once an OAuth App client ID is configured. Free to register:
// github.com/settings/developers → New OAuth App → enable Device Flow.

interface DeviceCodeResponse {
  device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number
}
interface TokenResponse {
  access_token?: string; error?: string; interval?: number
}

export async function startDeviceFlow(clientId: string): Promise<DeviceCodeSession & { deviceCode: string }> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: 'repo' }),
  })
  if (!res.ok) throw new GitHubError(`Device code request failed (${res.status})`, res.status)
  const d = (await res.json()) as DeviceCodeResponse
  return {
    deviceCode: d.device_code, userCode: d.user_code, verificationUri: d.verification_uri,
    expiresIn: d.expires_in, interval: d.interval,
  }
}

export type DevicePollStatus = 'pending' | 'slow_down' | 'expired' | 'denied' | 'ok'

/**
 * Polls until GitHub returns a token or a terminal error. `onStatus` is called on
 * every tick so the UI can show "still waiting" vs "slow down".
 */
export async function pollDeviceFlow(
  clientId: string,
  deviceCode: string,
  intervalSec: number,
  signal: AbortSignal,
  onStatus: (s: DevicePollStatus) => void,
): Promise<string> {
  let interval = intervalSec
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, interval * 1000))
    if (signal.aborted) break
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    })
    const j = (await res.json()) as TokenResponse
    if (j.access_token) {
      onStatus('ok')
      return j.access_token
    }
    switch (j.error) {
      case 'authorization_pending':
        onStatus('pending')
        break
      case 'slow_down':
        interval = (j.interval ?? interval) + 5
        onStatus('slow_down')
        break
      case 'expired_token':
        onStatus('expired')
        throw new GitHubError('The device code expired. Start again.', 410)
      case 'access_denied':
        onStatus('denied')
        throw new GitHubError('You cancelled the authorisation on GitHub.', 403)
      default:
        throw new GitHubError(j.error ?? 'Unknown device-flow error', 500)
    }
  }
  throw new GitHubError('Cancelled', 499)
}

export function openOnGitHub(path = ''): void {
  void shell.openExternal('https://github.com/' + path.replace(/^\//, ''))
}
