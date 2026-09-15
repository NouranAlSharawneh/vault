import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dir = { path: "" };
const crypt = { available: true };

// safeStorage is the macOS Keychain in production. Here it is a reversible stand-in, so
// the tests exercise the same two branches the app has: an encrypted file, and the
// `plain:` fallback used on a Linux box with no keyring.
vi.mock("electron", () => ({
  app: { getPath: () => dir.path },
  safeStorage: {
    isEncryptionAvailable: () => crypt.available,
    // Base64 rather than a prefix, so "the plaintext is not on disk" is a real check.
    encryptString: (s: string) => Buffer.from(`enc:${Buffer.from(s).toString("base64")}`),
    decryptString: (b: Buffer) => {
      const s = b.toString();
      if (!s.startsWith("enc:")) throw new Error("not encrypted by this key");

      return Buffer.from(s.slice(4), "base64").toString();
    },
  },
}));

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearToken,
  loadCredentials,
  loadToken,
  saveCredentials,
  saveToken,
} from "@main/store/token.store";

const tokenFile = (): string => join(dir.path, "github.token");

const creds = {
  accessToken: "gho_access",
  refreshToken: "ghr_refresh",
  expiresAt: 1_800_000_000_000,
  refreshExpiresAt: 1_900_000_000_000,
};

describe("token store", () => {
  beforeEach(() => {
    dir.path = mkdtempSync(join(tmpdir(), "vault-token-"));
    crypt.available = true;
  });

  afterEach(() => {
    rmSync(dir.path, { recursive: true, force: true });
  });

  it("round-trips the whole credential, not just the access token", () => {
    saveCredentials(creds);

    expect(loadCredentials()).toEqual(creds);
    expect(loadToken()).toBe("gho_access");
  });

  it("encrypts what it writes", () => {
    saveCredentials(creds);
    const onDisk = readFileSync(tokenFile()).toString();

    expect(onDisk).not.toContain("gho_access");
    expect(onDisk.startsWith("enc:")).toBe(true);
  });

  it("writes the file readable only by its owner", () => {
    saveCredentials(creds);

    expect(statSync(tokenFile()).mode & 0o777).toBe(0o600);
  });

  it("still stores the token when the machine has no keyring", () => {
    crypt.available = false;
    saveCredentials(creds);

    expect(readFileSync(tokenFile()).toString().startsWith("plain:")).toBe(true);
    expect(loadToken()).toBe("gho_access");
  });

  it("reads a bare token written by a build from before refresh tokens", () => {
    writeFileSync(tokenFile(), Buffer.from("plain:gho_ancient"));

    expect(loadCredentials()).toEqual({
      accessToken: "gho_ancient",
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
    });
  });

  it("fills in the fields a partial credential is missing", () => {
    saveToken("gho_pat");

    expect(loadCredentials()).toEqual({
      accessToken: "gho_pat",
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
    });
  });

  it("is signed out, not broken, when there is no token file", () => {
    expect(loadCredentials()).toBeNull();
    expect(loadToken()).toBeNull();
  });

  it("is signed out when the file is unreadable garbage", () => {
    writeFileSync(tokenFile(), Buffer.from("plain:{ half a json"));

    expect(loadCredentials()).toBeNull();
  });

  it("is signed out when the stored JSON has no access token", () => {
    writeFileSync(tokenFile(), Buffer.from(`plain:${JSON.stringify({ refreshToken: "r" })}`));

    expect(loadCredentials()).toBeNull();
  });

  it("is signed out when the key that encrypted the file is gone", () => {
    // Keychain reset, or the file copied to another machine: decryptString throws.
    writeFileSync(tokenFile(), Buffer.from("garbage-from-another-key"));

    expect(loadCredentials()).toBeNull();
  });

  it("removes the file on sign-out, and does not mind doing it twice", () => {
    saveCredentials(creds);
    clearToken();

    expect(existsSync(tokenFile())).toBe(false);
    expect(() => clearToken()).not.toThrow();
    expect(loadToken()).toBeNull();
  });
});
