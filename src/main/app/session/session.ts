import { existsSync } from "node:fs";
import { GIT_NOT_READY, TOKEN_REFRESH_SKEW_MS } from "@shared/constants";
import type { AuthMethod, AuthState, GitHubUser, VaultConfig } from "@shared/types";
import { fire } from "../../lib/fire";
import { NetworkError } from "../../network/axios";
import { fetchUser, refreshAccessToken } from "../../network/github";
import { refreshGitStatus } from "../../services/git/git-status.service";
import { VaultService } from "../../services/vault/vault.service";
import { getOAuthConfig } from "../../store/oauth-config";
import { getSettings, updateSettings } from "../../store/settings.store";
import { clearToken, loadCredentials, loadToken, saveCredentials } from "../../store/token.store";
import type { StoredCredentials } from "../../store/token.store.types";
import { userDataDir } from "../../store/user-data-dir";
import { broadcast } from "../../windows";
import type { AuthListener } from "./session.types";

const MISSING_ROOT = "The folder isn’t there any more. It may have been moved, renamed or deleted.";

/**
 * Process-wide state: who is signed in and which vault is open.
 * Everything else (IPC, menu) reads through here.
 */
class Session {
  private vaultService: VaultService | null = null;
  /** Why the configured vault is not open, when it should be. Cleared by the next open. */
  private openFailure: string | null = null;
  private authState: AuthState = { status: "signed-out", user: null, method: null };
  private listeners = new Set<AuthListener>();

  get vault(): VaultService | null {
    return this.vaultService;
  }

  get auth(): AuthState {
    return this.authState;
  }

  requireVault(): VaultService {
    if (!this.vaultService) throw new Error(this.openFailure ?? "No vault is open");

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

  /**
   * Something got a 401. Try to renew before telling the user they are signed out —
   * an expiring token that we can refresh is not a sign-out, it is a Tuesday.
   * Returns true when the credentials are usable again.
   */
  async revalidate(): Promise<boolean> {
    // `fetchUser` below goes through the same interceptor that calls us on a 401.
    if (this.revalidating) return false;
    this.revalidating = true;
    try {
      return await this.doRevalidate();
    } finally {
      this.revalidating = false;
    }
  }

  private revalidating = false;

  private async doRevalidate(): Promise<boolean> {
    if (await this.refreshIfPossible()) {
      await this.markAuthOk();

      return true;
    }
    try {
      const user = await fetchUser();
      // The token still works, so whatever failed was not an auth problem.
      this.setAuth({ status: "signed-in", user, method: this.authState.method });

      return true;
    } catch (e) {
      if (e instanceof NetworkError && !e.isAuth) return true; // offline, not signed out
      this.markAuthExpired();

      return false;
    }
  }

  /** Renew with the refresh token, when the app issues expiring tokens. */
  private async refreshIfPossible(): Promise<boolean> {
    const creds = loadCredentials();
    const config = getOAuthConfig();
    if (!creds?.refreshToken || !config) return false;
    if (creds.refreshExpiresAt && creds.refreshExpiresAt < Date.now()) return false;
    try {
      saveCredentials(
        await refreshAccessToken({
          clientId: config.clientId,
          refreshToken: creds.refreshToken,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  /** Renew ahead of time when the stored token is at or near its deadline. */
  async freshenToken(): Promise<void> {
    const creds = loadCredentials();
    if (!creds?.expiresAt || creds.expiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS) return;
    if (await this.refreshIfPossible()) await this.markAuthOk();
  }

  /** A GitHub call succeeded, so clear a stale "signed you out" banner. */
  async markAuthOk(): Promise<void> {
    if (this.authState.status === "signed-in" && this.authState.user) return;
    try {
      const user = await fetchUser();
      this.setAuth({ status: "signed-in", user, method: this.authState.method });
    } catch {
      /* leave the current state alone */
    }
  }

  private retryingPush = false;

  private async onAuthSuspect(vault: VaultService): Promise<void> {
    const usable = await this.revalidate();
    if (!usable || this.retryingPush) return;
    this.retryingPush = true;
    try {
      await vault.pushNow();
    } finally {
      this.retryingPush = false;
    }
  }

  markAuthExpired(): void {
    if (this.authState.status !== "expired") {
      this.setAuth({ status: "expired", user: this.authState.user, method: this.authState.method });
    }
  }

  async signIn(creds: StoredCredentials, method: AuthMethod): Promise<GitHubUser> {
    saveCredentials(creds);
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
    const vault = new VaultService(
      config,
      userDataDir(),
      () => loadToken(),
      () => this.freshenToken(),
    );
    vault.on("index", (s) => broadcast("index:changed", s));
    vault.on("progress", (p) => broadcast("index:progress", p));
    vault.on("sync", (s) => broadcast("sync:status", s));
    // A push failed in a way that *might* mean the token died. Check before believing it,
    // and if renewing fixed things, finish the push the user already asked for.
    vault.on("auth-suspect", () => fire(this.onAuthSuspect(vault), "checking the token"));
    vault.on("auth-ok", () => fire(this.markAuthOk(), "confirming the token"));
    this.vaultService = vault;
    this.openFailure = null;
    try {
      await vault.open();
    } catch (e) {
      // A half-open vault answered with an empty index, so the window showed an empty
      // library and a green badge. Nothing is open; say so, and why, to whoever asks.
      this.vaultService = null;
      this.openFailure = e instanceof Error ? e.message : String(e);
      await vault.close().catch(() => undefined);
      throw e;
    }

    return vault;
  }

  /** Try the configured vault again, after a failed open at launch. */
  async reopenVault(): Promise<VaultService> {
    const config = getSettings().vault;
    if (!config) throw new Error("No vault is set up");
    // `open()` creates a missing root, which would quietly replace a moved vault with an
    // empty one. A folder that is gone has to stay a failure until the user decides.
    if (!existsSync(config.root)) {
      this.openFailure = MISSING_ROOT;
      throw new Error(MISSING_ROOT);
    }
    await this.requireGit();

    return this.openVault(config);
  }

  async closeVault(): Promise<void> {
    await this.vaultService?.close();
    this.vaultService = null;
    this.openFailure = null;
  }

  /** Restore token + vault from a previous run. Never throws. */
  async restore(): Promise<void> {
    const s = getSettings();
    if (loadToken()) {
      await this.freshenToken();
      try {
        const user = await fetchUser();
        this.authState = { status: "signed-in", user, method: s.authMethod ?? "pat" };
      } catch (e) {
        const unauthorized = e instanceof NetworkError && e.isAuth;
        // A 401 here may just be an expired access token we can renew. Anything else
        // (offline, GitHub down) is not a sign-out, and must not cost a second timeout.
        const renewed = unauthorized && (await this.refreshIfPossible());
        this.authState = {
          status: unauthorized && !renewed ? "expired" : "signed-in",
          user: renewed ? await fetchUser().catch(() => null) : null,
          method: s.authMethod,
        };
      }
    }
    if (s.vault && !existsSync(s.vault.root)) this.openFailure = MISSING_ROOT;
    else if (s.vault) {
      try {
        await this.requireGit();
        await this.openVault(s.vault);
      } catch (e) {
        console.error("Failed to open vault", e);
      }
    } else {
      // Nothing to open yet, but onboarding asks straight away: find out now.
      await refreshGitStatus();
    }
  }

  /**
   * Refuse to open a vault while git can't run. Opening runs git at once, and on a Mac
   * whose developer tools are gone that means Apple's install dialog on every launch,
   * followed by an `xcrun` error nobody can act on. The renderer explains from GitStatus.
   */
  private async requireGit(): Promise<void> {
    if ((await refreshGitStatus()).state === "ready") return;
    this.openFailure = GIT_NOT_READY;
    throw new Error(GIT_NOT_READY);
  }
}

export const session = new Session();
