export type TokenProvider = () => string | null;
export type AuthExpiredHandler = () => void;

export interface NetworkOptions {
  getToken: TokenProvider;
  onAuthExpired?: AuthExpiredHandler;
  /** Override hosts (tests point these at a local fake). */
  baseUrls?: { api?: string; oauth?: string };
}
