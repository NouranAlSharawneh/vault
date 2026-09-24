import { afterEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({ githubClientId: null as string | null }));
vi.mock("@main/store/settings.store", () => ({ getSettings: () => settings }));

import { getOAuthConfig } from "@main/store/oauth-config";

/**
 * The OAuth config is what the shipped app knows about its GitHub OAuth App. Only the
 * client ID belongs in there: a secret compiled into the binary can be read by anyone.
 */
describe("getOAuthConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    settings.githubClientId = null;
  });

  it("is null when no client ID is configured anywhere", () => {
    vi.stubEnv("VAULT_GITHUB_CLIENT_ID", "");
    expect(getOAuthConfig()).toBeNull();
  });

  it("returns the client ID from the environment", () => {
    vi.stubEnv("VAULT_GITHUB_CLIENT_ID", "Iv1.abc");
    expect(getOAuthConfig()).toEqual({ clientId: "Iv1.abc" });
  });

  it("falls back to the client ID saved in settings", () => {
    vi.stubEnv("VAULT_GITHUB_CLIENT_ID", "");
    settings.githubClientId = "Iv1.fromSettings";
    expect(getOAuthConfig()).toEqual({ clientId: "Iv1.fromSettings" });
  });

  it("never picks up a client secret, even when one is in the environment", () => {
    vi.stubEnv("VAULT_GITHUB_CLIENT_ID", "Iv1.abc");
    vi.stubEnv("VAULT_GITHUB_CLIENT_SECRET", "leaked");
    vi.stubEnv("MAIN_VITE_GITHUB_CLIENT_SECRET", "leaked");
    const config = getOAuthConfig();
    expect(config).toEqual({ clientId: "Iv1.abc" });
    expect(JSON.stringify(config)).not.toContain("leaked");
  });
});
