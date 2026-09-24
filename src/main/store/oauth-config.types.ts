export interface OAuthConfig {
  /** Public OAuth App ID. There is deliberately no secret: the device flow needs none. */
  clientId: string;
}
