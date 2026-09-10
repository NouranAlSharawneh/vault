export type TokenProvider = () => string | null;

export interface VaultEvents {
  index: unknown;
  progress: unknown;
  sync: unknown;
  "auth-expired": void;
}
