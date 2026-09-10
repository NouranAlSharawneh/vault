export interface LoopbackOptions {
  /** Expected `state` — any callback with a different value is rejected. */
  state: string;
  /** Ports to try, in order. */
  ports: readonly number[];
  host: string;
  path: string;
  timeoutMs: number;
}

export interface LoopbackServer {
  port: number;
  redirectUri: string;
  /** Resolves with the authorization code, rejects on timeout / mismatch / GitHub error. */
  code: Promise<string>;
  close: () => void;
}
