import type { StoredCredentials } from "../../store/token.store.types";
import type { RawDeviceToken } from "./github.types";

/** Turn GitHub's token response into what we persist, resolving `expires_in` to a deadline. */
export function toCredentials(data: RawDeviceToken, now = Date.now()): StoredCredentials {
  const seconds = (n: number | undefined) => (typeof n === "number" ? now + n * 1000 : null);
  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token ?? null,
    expiresAt: seconds(data.expires_in),
    refreshExpiresAt: seconds(data.refresh_token_expires_in),
  };
}
