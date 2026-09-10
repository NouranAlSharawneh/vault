import { existsSync } from "node:fs";
import type { AuthMethod, AuthState, GitHubUser, VaultConfig } from "@shared/types";
import { getSettings, updateSettings } from "../../store/settings.store";
import { clearToken, loadToken, saveToken } from "../../store/token.store";
import { userDataDir } from "../../store/user-data-dir";
import { fetchUser } from "../../network/github";
import { NetworkError } from "../../network/axios";
import { VaultService } from "../../services/vault/vault.service";
import { broadcast } from "../../windows";
import type { AuthListener } from "./session.types";

/**
 * Process-wide state: who is signed in and which vault is open.
 * Everything else (IPC, tray, menu) reads through here.
 */
class Session {
  private vaultService: VaultService | null = null;
  private authState: AuthState = { status: "signed-out", user: null, method: null };
  private listeners = new Set<AuthListener>();

  get vault(): VaultService | null {
    return this.vaultService;
  }

  get auth(): AuthState {
    return this.authState;
  }

  requireVault(): VaultService {
    if (!this.vaultService) throw new Error("No vault is open");
    return this.vaultService;
  }

  onAuthChange(fn: AuthListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setAuth(next: AuthState): void {
    this.authState = next;
    broadcast("auth:state", next);
    for (const fn of this.listeners) fn(next);
  }

  markAuthExpired(): void {
    if (this.authState.status !== "expired") {
      this.setAuth({ status: "expired", user: this.authState.user, method: this.authState.method });
    }
  }

  async signIn(token: string, method: AuthMethod): Promise<GitHubUser> {
    saveToken(token);
    try {
      const user = await fetchUser();
      updateSettings({ authMethod: method });
      this.setAuth({ status: "signed-in", user, method });
      return user;
    } catch (e) {
      clearToken();
      throw e;
    }
  }

  signOut(): void {
    clearToken();
    this.setAuth({ status: "signed-out", user: null, method: null });
  }

  async openVault(config: VaultConfig): Promise<VaultService> {
    await this.vaultService?.close();
    const vault = new VaultService(config, userDataDir(), () => loadToken());
    vault.on("index", (s) => broadcast("index:changed", s));
    vault.on("progress", (p) => broadcast("index:progress", p));
    vault.on("sync", (s) => broadcast("sync:status", s));
    vault.on("auth-expired", () => this.markAuthExpired());
    this.vaultService = vault;
    await vault.open();
    return vault;
  }

  async closeVault(): Promise<void> {
    await this.vaultService?.close();
    this.vaultService = null;
  }

  /** Restore token + vault from a previous run. Never throws. */
  async restore(): Promise<void> {
    const s = getSettings();
    if (loadToken()) {
      try {
        const user = await fetchUser();
        this.authState = { status: "signed-in", user, method: s.authMethod ?? "pat" };
      } catch (e) {
        const expired = e instanceof NetworkError && e.isAuth;
        this.authState = {
          status: expired ? "expired" : "signed-in",
          user: null,
          method: s.authMethod,
        };
      }
    }
    if (s.vault && existsSync(s.vault.root)) {
      try {
        await this.openVault(s.vault);
      } catch (e) {
        console.error("Failed to open vault", e);
      }
    }
  }
}

export const session = new Session();
