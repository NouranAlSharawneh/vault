import type { StoredCredentials } from "../../store/token.store.types";
import { githubOAuth, NetworkError } from "../axios";
import type { RawDeviceToken, RefreshParams } from "./github.types";
import { toCredentials } from "./token-grant";

/**
 * Trade a refresh token for a new access token. Only applies when the GitHub app issues
 * expiring tokens — otherwise there is no refresh token and nothing to do. No client
 * secret is sent: the shipped app has none (anything in the binary is public). If GitHub
 * insists on one, this fails and the user is asked to sign in again.
 */
export async function refreshAccessToken({
  clientId,
  refreshToken,
}: RefreshParams): Promise<StoredCredentials> {
  const { data } = await githubOAuth().post<RawDeviceToken>("/login/oauth/access_token", {
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (!data.access_token) {
    throw new NetworkError(data.error ?? "GitHub refused to refresh the token", 401);
  }

  return toCredentials(data);
}
