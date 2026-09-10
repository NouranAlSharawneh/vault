import { safeStorage } from "electron";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userDataDir } from "./user-data-dir";

/** GitHub token, encrypted with Electron's safeStorage (macOS Keychain-backed key). */
const PLAIN_PREFIX = "plain:";

function tokenPath(): string {
  return join(userDataDir(), "github.token");
}

export function saveToken(token: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(tokenPath(), safeStorage.encryptString(token));
  } else {
    // Linux without a keyring, or CI. Still never in the repo.
    writeFileSync(tokenPath(), Buffer.from(PLAIN_PREFIX + token), { mode: 0o600 });
  }
}

export function loadToken(): string | null {
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

export function clearToken(): void {
  try {
    unlinkSync(tokenPath());
  } catch {
    /* already gone */
  }
}
