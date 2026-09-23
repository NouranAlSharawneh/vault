import { beforeEach, describe, expect, it, vi } from "vitest";

// The session is the only place that decides "signed in", "expired" or "leave it alone",
// and every input it reads is a module: the stored credentials, the settings, and two
// GitHub calls. All four are stubbed so each branch can be put in front of it directly.
// vi.hoisted, because vi.mock is lifted above these declarations and the factories below
// close over them.
const github = vi.hoisted(() => ({ fetchUser: vi.fn(), refreshAccessToken: vi.fn() }));
const store = vi.hoisted(() => ({
  credentials: null as null | Record<string, unknown>,
  saved: [] as unknown[],
  cleared: 0,
}));
const oauth = vi.hoisted(() => ({
  config: null as null | { clientId: string; clientSecret: string },
}));
const settings = vi.hoisted(() => ({
  value: { vault: null, authMethod: "pat", githubClientId: null, onboarded: true },
}));

vi.mock("electron", () => ({ app: { getPath: () => "/tmp" } }));
vi.mock("@main/network/github", () => github);
vi.mock("@main/windows", () => ({ broadcast: vi.fn() }));
vi.mock("@main/store/oauth-config", () => ({ getOAuthConfig: () => oauth.config }));
vi.mock("@main/store/settings.store", () => ({
  getSettings: () => settings.value,
  updateSettings: vi.fn(),
}));
vi.mock("@main/store/token.store", () => ({
  loadCredentials: () => store.credentials,
  loadToken: () => (store.credentials?.accessToken as string | undefined) ?? null,
  saveCredentials: (c: unknown) => {
    store.saved.push(c);
    store.credentials = c as Record<string, unknown>;
  },
  clearToken: () => {
    store.cleared += 1;
    store.credentials = null;
  },
}));

import { session } from "@main/app/session/session";
import { NetworkError } from "@main/network/axios";
import { TOKEN_REFRESH_SKEW_MS } from "@shared/constants";

const USER = { login: "nunu", name: "Nunu", avatarUrl: "" };

const signedInWith = (over: Partial<Record<string, unknown>> = {}): void => {
  store.credentials = {
    accessToken: "gho_access",
    refreshToken: null,
    expiresAt: null,
    refreshExpiresAt: null,
    ...over,
  };
};

/**
 * The session is a process-wide singleton, and the module graph has to stay the one the
 * test imported — reloading it gives the session a second copy of NetworkError, and
 * every `instanceof` check inside it silently stops matching. So: same instance, auth
 * state wound back.
 */
function freshSession(): typeof session {
  session.setAuth({ status: "signed-out", user: null, method: null });

  return session;
}

describe("session", () => {
  beforeEach(() => {
    github.fetchUser.mockReset();
    github.refreshAccessToken.mockReset();
    store.credentials = null;
    store.saved = [];
    store.cleared = 0;
    oauth.config = null;
    settings.value = { vault: null, authMethod: "pat", githubClientId: null, onboarded: true };
  });

  describe("restore", () => {
    it("signs in when the stored token still works", async () => {
      signedInWith();
      github.fetchUser.mockResolvedValue(USER);
      const session = freshSession();
      await session.restore();

      expect(session.auth).toMatchObject({ status: "signed-in", user: USER, method: "pat" });
    });

    it("stays signed out without asking GitHub anything when there is no token", async () => {
      const session = freshSession();
      await session.restore();

      expect(github.fetchUser).not.toHaveBeenCalled();
      expect(session.auth.status).toBe("signed-out");
    });

    it("does not sign the user out because the machine is offline", async () => {
      // A dead wifi connection must not look like a revoked token, or the app greets
      // the user with "signed out" every time they open the laptop on a train.
      signedInWith();
      github.fetchUser.mockRejectedValue(new NetworkError("getaddrinfo ENOTFOUND", 0, "ENOTFOUND"));
      const session = freshSession();
      await session.restore();

      expect(session.auth.status).toBe("signed-in");
    });

    it("is expired when the token is genuinely rejected and cannot be renewed", async () => {
      signedInWith();
      github.fetchUser.mockRejectedValue(new NetworkError("Bad credentials", 401));
      const session = freshSession();
      await session.restore();

      expect(session.auth.status).toBe("expired");
      expect(github.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("renews silently when a 401 is only an expired access token", async () => {
      signedInWith({ refreshToken: "ghr_refresh" });
      oauth.config = { clientId: "id", clientSecret: "secret" };
      github.fetchUser.mockRejectedValueOnce(new NetworkError("Bad credentials", 401));
      github.refreshAccessToken.mockResolvedValue({
        accessToken: "gho_new",
        refreshToken: "ghr_new",
        expiresAt: Date.now() + 3_600_000,
        refreshExpiresAt: null,
      });
      github.fetchUser.mockResolvedValueOnce(USER);
      const session = freshSession();
      await session.restore();

      expect(session.auth).toMatchObject({ status: "signed-in", user: USER });
      expect(store.saved).toHaveLength(1);
    });

    it("is expired when the refresh token is itself past its deadline", async () => {
      signedInWith({ refreshToken: "ghr_refresh", refreshExpiresAt: Date.now() - 1000 });
      oauth.config = { clientId: "id", clientSecret: "secret" };
      github.fetchUser.mockRejectedValue(new NetworkError("Bad credentials", 401));
      const session = freshSession();
      await session.restore();

      expect(github.refreshAccessToken).not.toHaveBeenCalled();
      expect(session.auth.status).toBe("expired");
    });
  });

  describe("revalidate", () => {
    it("says the credentials are fine when the token still works", async () => {
      signedInWith();
      github.fetchUser.mockResolvedValue(USER);
      const session = freshSession();

      await expect(session.revalidate()).resolves.toBe(true);
      expect(session.auth.status).toBe("signed-in");
    });

    it("marks the session expired when GitHub rejects the token", async () => {
      signedInWith();
      github.fetchUser.mockRejectedValue(new NetworkError("Bad credentials", 401));
      const session = freshSession();

      await expect(session.revalidate()).resolves.toBe(false);
      expect(session.auth.status).toBe("expired");
    });

    it("treats an unreachable GitHub as usable, not as a sign-out", async () => {
      signedInWith();
      github.fetchUser.mockRejectedValue(new NetworkError("socket hang up", 0));
      const session = freshSession();

      await expect(session.revalidate()).resolves.toBe(true);
      expect(session.auth.status).not.toBe("expired");
    });

    it("does not recurse when the check itself trips the 401 that called it", async () => {
      // fetchUser goes through the same interceptor that calls revalidate on a 401.
      // Without the re-entry guard this is an infinite loop, not a failed request.
      signedInWith();
      let depth = 0;
      // Capped so a missing guard fails the assertion instead of exhausting the heap.
      github.fetchUser.mockImplementation(async () => {
        depth += 1;
        if (depth < 5) await session.revalidate();
        throw new NetworkError("Bad credentials", 401);
      });
      const session = freshSession();

      await expect(session.revalidate()).resolves.toBe(false);
      expect(depth).toBe(1);
    });
  });

  describe("freshenToken", () => {
    it("renews a token that is about to expire", async () => {
      signedInWith({
        refreshToken: "ghr_refresh",
        expiresAt: Date.now() + TOKEN_REFRESH_SKEW_MS - 1000,
      });
      oauth.config = { clientId: "id", clientSecret: "secret" };
      github.refreshAccessToken.mockResolvedValue({
        accessToken: "gho_new",
        refreshToken: "ghr_new",
        expiresAt: Date.now() + 3_600_000,
        refreshExpiresAt: null,
      });
      github.fetchUser.mockResolvedValue(USER);
      const session = freshSession();
      await session.freshenToken();

      expect(github.refreshAccessToken).toHaveBeenCalledOnce();
    });

    it("leaves a token with plenty of time on it alone", async () => {
      signedInWith({ refreshToken: "ghr_refresh", expiresAt: Date.now() + 60 * 60 * 1000 });
      oauth.config = { clientId: "id", clientSecret: "secret" };
      const session = freshSession();
      await session.freshenToken();

      expect(github.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("does nothing for a token that never expires", async () => {
      signedInWith();
      const session = freshSession();
      await session.freshenToken();

      expect(github.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("sign in and out", () => {
    it("keeps nothing when GitHub rejects the credentials it was just handed", async () => {
      github.fetchUser.mockRejectedValue(new NetworkError("Bad credentials", 401));
      const session = freshSession();

      await expect(
        session.signIn(
          { accessToken: "gho_bad", refreshToken: null, expiresAt: null, refreshExpiresAt: null },
          "pat",
        ),
      ).rejects.toThrow();
      expect(store.cleared).toBe(1);
      expect(session.auth.status).toBe("signed-out");
    });

    it("forgets the token on sign-out", async () => {
      signedInWith();
      github.fetchUser.mockResolvedValue(USER);
      const session = freshSession();
      await session.restore();
      session.signOut();

      expect(store.cleared).toBe(1);
      expect(session.auth).toEqual({ status: "signed-out", user: null, method: null });
    });
  });
});
