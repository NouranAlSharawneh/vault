import { githubOAuth, NetworkError } from "../axios";
import type { StoredCredentials } from "../../store/token.store.types";
import type { RawDeviceToken, RefreshParams } from "./github.types";
import { toCredentials } from "./token-grant";

/**
 * Trade a refresh token for a new access token. Only applies when the GitHub app issues
 * expiring tokens — otherwise there is no refresh token and nothing to do.
 */
export async function refreshAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}: RefreshParams): Promise<StoredCredentials> {
  const { data } = await githubOAuth().post<RawDeviceToken>("/login/oauth/access_token", {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (!data.access_token) {
    throw new NetworkError(data.error ?? "GitHub refused to refresh the token", 401);
  }
  return toCredentials(data);
}
