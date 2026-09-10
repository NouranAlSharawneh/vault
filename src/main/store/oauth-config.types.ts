export interface OAuthConfig {
  clientId: string;
  /** Required for the web flow's code exchange; optional for device flow. */
  clientSecret: string | null;
}
