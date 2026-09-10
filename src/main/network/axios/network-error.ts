/** Normalised error thrown by every network call. `status` is 0 when the request never reached a server. */
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "NetworkError";
  }

  get isAuth(): boolean {
    return this.status === 401;
  }

  get isOffline(): boolean {
    return this.status === 0;
  }
}
