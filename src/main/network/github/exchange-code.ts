import { githubOAuth, NetworkError } from "../axios";
import type { StoredCredentials } from "../../store/token.store.types";
import type { ExchangeParams, RawDeviceToken } from "./github.types";
import { toCredentials } from "./token-grant";

/** Step 2 of the web flow: trade the one-time `code` for an access token. */
export async function exchangeCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
}: ExchangeParams): Promise<StoredCredentials> {
  const { data } = await githubOAuth().post<RawDeviceToken>("/login/oauth/access_token", {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  if (!data.access_token)
    throw new NetworkError(data.error ?? "GitHub did not return a token", 400);
  return toCredentials(data);
}
