import { describe, expect, it } from "vitest";
import { startLoopbackServer } from "@main/services/auth/loopback-server";

const opts = {
  ports: [47931, 47932, 47933],
  host: "127.0.0.1",
  path: "/callback",
  timeoutMs: 5_000,
};

describe("loopback server", () => {
  it("resolves the code when state matches and serves a success page", async () => {
    const server = await startLoopbackServer({ ...opts, state: "abc" });
    const res = await fetch(`${server.redirectUri}?code=the-code&state=abc`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You're signed in");
    await expect(server.code).resolves.toBe("the-code");
    server.close();
  });

  it("rejects on state mismatch", async () => {
    const server = await startLoopbackServer({ ...opts, state: "abc" });
    const res = await fetch(`${server.redirectUri}?code=x&state=WRONG`);
    expect(res.status).toBe(400);
    await expect(server.code).rejects.toThrow("state mismatch");
    server.close();
  });

  it("surfaces GitHub's error param", async () => {
    const server = await startLoopbackServer({ ...opts, state: "abc" });
    await fetch(
      `${server.redirectUri}?error=access_denied&error_description=The+user+denied&state=abc`,
    );
    await expect(server.code).rejects.toThrow("The user denied");
    server.close();
  });

  it("falls back to the next port when the first is busy", async () => {
    const a = await startLoopbackServer({ ...opts, state: "s1" });
    const b = await startLoopbackServer({ ...opts, state: "s2" });
    expect(a.port).toBe(47931);
    expect(b.port).toBe(47932);
    a.close();
    b.close();
  });

  it("rejects with timeout", async () => {
    const server = await startLoopbackServer({ ...opts, state: "abc", timeoutMs: 50 });
    await expect(server.code).rejects.toThrow("timeout");
  });

  it("rejects with cancelled on close", async () => {
    const server = await startLoopbackServer({ ...opts, state: "abc" });
    server.close();
    await expect(server.code).rejects.toThrow("cancelled");
  });
});
