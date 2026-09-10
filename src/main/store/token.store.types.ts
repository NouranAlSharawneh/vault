/** What GitHub hands back from an authorization, as far as we need to keep it. */
export interface StoredCredentials {
  accessToken: string;
  /** Present only when GitHub issues expiring tokens; without it we can never renew. */
  refreshToken: string | null;
  /** Epoch ms the access token stops working, or null when it does not expire. */
  expiresAt: number | null;
  /** Epoch ms the refresh token itself stops working. */
  refreshExpiresAt: number | null;
}
