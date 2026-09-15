import { GITHUB_WEB, OAUTH_SCOPE } from "@shared/constants";
import type { AuthorizeParams } from "./github.types";

/** The URL that shows GitHub's "Authorize <app>" page. */
export function buildAuthorizeUrl({ clientId, redirectUri, state }: AuthorizeParams): string {
  const url = new URL("/login/oauth/authorize", GITHUB_WEB);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");

  return url.toString();
}
