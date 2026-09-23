import type { OAuthConfig } from "./oauth-config.types";
import { getSettings } from "./settings.store";

/**
 * OAuth App credentials. Read from the build-time env (`MAIN_VITE_*` in `.env`, see
 * `.env.example`), then the process env, then settings. Never committed to the repo.
 */
export function getOAuthConfig(): OAuthConfig | null {
  const clientId =
    import.meta.env.MAIN_VITE_GITHUB_CLIENT_ID ||
    process.env.VAULT_GITHUB_CLIENT_ID ||
    getSettings().githubClientId;
  if (!clientId) return null;
  const clientSecret =
    import.meta.env.MAIN_VITE_GITHUB_CLIENT_SECRET ||
    process.env.VAULT_GITHUB_CLIENT_SECRET ||
    null;

  return { clientId, clientSecret };
}
