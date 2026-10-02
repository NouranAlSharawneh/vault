/**
 * Quit again once `work` has settled, success or not, from a fresh turn of the event loop.
 *
 * `will-quit` is held while the vault pushes and closes, then the quit is asked for again.
 * Asked for straight from the promise, a shutdown with nothing to wait on settled in the
 * same turn as `will-quit` itself: Electron still counted itself as quitting, dropped the
 * call, and only then cleared the flag. The windows were gone and the process stayed, so
 * ⌘Q left Marasca running, and an update waiting for it to exit waited in vain.
 */
export function quitAfter(work: Promise<unknown>, quit: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    work
      .finally(() =>
        setImmediate(() => {
          quit();
          resolve();
        }),
      )
      .catch(reject);
  });
}
