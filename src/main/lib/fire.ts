/**
 * Start something that may fail where there is nobody to tell, and record it.
 *
 * Main has no toast and no user attention; the honest thing it can do with a background
 * failure is name it in the log rather than drop it. Anything a person should hear about
 * travels to the renderer as state — a sync status, an auth event — not through here.
 */
export function fire(promise: Promise<unknown>, what: string): void {
  promise.catch((e: unknown) => console.error(`${what} failed:`, e));
}
