import type { OAuthConfig } from "./oauth-config.types";
import { getSettings } from "./settings.store";

/**
 * OAuth App client ID, for the device flow. Read from the build-time env
 * (`MAIN_VITE_GITHUB_CLIENT_ID` in `.env`, see `.env.example`), then the process env, then
 * settings. The ID is public by design; the app never reads a client secret, because
 * anything baked into the binary can be pulled out of it.
 */
export function getOAuthConfig(): OAuthConfig | null {
  const clientId =
    import.meta.env.MAIN_VITE_GITHUB_CLIENT_ID ||
    process.env.VAULT_GITHUB_CLIENT_ID ||
    getSettings().githubClientId;

  return clientId ? { clientId } : null;
}
