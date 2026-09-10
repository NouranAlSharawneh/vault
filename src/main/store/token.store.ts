import { safeStorage } from "electron";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userDataDir } from "./user-data-dir";
import type { StoredCredentials } from "./token.store.types";

/**
 * GitHub credentials, encrypted with Electron's safeStorage (macOS Keychain-backed key).
 *
 * Stored as JSON so an expiring token can be renewed without asking the user to
 * authorize again. Files written by older builds hold a bare access token; those are
 * still read, and upgrade to the JSON shape on the next sign-in.
 */
const PLAIN_PREFIX = "plain:";

function tokenPath(): string {
  return join(userDataDir(), "github.token");
}

function write(payload: string): void {
  const encrypted = safeStorage.isEncryptionAvailable();
  // Linux without a keyring, or CI. Still never in the repo.
  const body = encrypted ? safeStorage.encryptString(payload) : Buffer.from(PLAIN_PREFIX + payload);
  writeFileSync(tokenPath(), body, { mode: 0o600 });
}

function read(): string | null {
  try {
    const buf = readFileSync(tokenPath());
    if (buf.subarray(0, PLAIN_PREFIX.length).toString() === PLAIN_PREFIX) {
      return buf.subarray(PLAIN_PREFIX.length).toString();
    }
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export function saveCredentials(creds: StoredCredentials): void {
  write(JSON.stringify(creds));
}

export function loadCredentials(): StoredCredentials | null {
  const raw = read();
  if (!raw) return null;
  if (!raw.startsWith("{")) {
    // Pre-refresh-token build: a bare access token, no expiry information.
    return { accessToken: raw, refreshToken: null, expiresAt: null, refreshExpiresAt: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
    if (!parsed.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? null,
      expiresAt: parsed.expiresAt ?? null,
      refreshExpiresAt: parsed.refreshExpiresAt ?? null,
    };
  } catch {
    return null;
  }
}

/** The access token as-is. Callers that may hit the network want `session.freshToken()`. */
export function loadToken(): string | null {
  return loadCredentials()?.accessToken ?? null;
}

export function saveToken(token: string): void {
  saveCredentials({
    accessToken: token,
    refreshToken: null,
    expiresAt: null,
    refreshExpiresAt: null,
  });
}

export function clearToken(): void {
  try {
    unlinkSync(tokenPath());
  } catch {
    /* already gone */
  }
}
