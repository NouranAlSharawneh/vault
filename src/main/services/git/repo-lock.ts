/**
 * A promise queue: each piece of work starts when the one before it has settled, and a
 * failure is its caller's to handle — the queue itself always moves on.
 */
export class RepoLock {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work, work);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );

    return next;
  }
}
