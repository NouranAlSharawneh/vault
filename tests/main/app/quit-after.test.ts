import { describe, expect, it, vi } from "vitest";
import { quitAfter } from "@main/app/session/quit-after";

describe("quitAfter", () => {
  it("quits on a later turn, never in the same one as a shutdown that was already done", async () => {
    // Electron drops a quit asked for while `will-quit` is still on the stack, so a shutdown
    // with nothing to push must not reach `quit` through microtasks alone.
    const quit = vi.fn();
    const done = quitAfter(Promise.resolve(), quit);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(quit).not.toHaveBeenCalled();
    await done;
    expect(quit).toHaveBeenCalledOnce();
  });

  it("still quits when the shutdown failed, and passes the failure on", async () => {
    const quit = vi.fn();
    await expect(quitAfter(Promise.reject(new Error("push failed")), quit)).rejects.toThrow(
      "push failed",
    );
    await new Promise((r) => setImmediate(r));
    expect(quit).toHaveBeenCalledOnce();
  });
});
