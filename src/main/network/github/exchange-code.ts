import { githubOAuth, NetworkError } from "../axios";
import type { ExchangeParams, RawDeviceToken } from "./github.types";

/** Step 2 of the web flow: trade the one-time `code` for an access token. */
export async function exchangeCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
}: ExchangeParams): Promise<string> {
  const { data } = await githubOAuth().post<RawDeviceToken>("/login/oauth/access_token", {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  if (!data.access_token)
    throw new NetworkError(data.error ?? "GitHub did not return a token", 400);
  return data.access_token;
}
