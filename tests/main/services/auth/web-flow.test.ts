import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";

// `electron` can't load under vitest; the "browser" here just follows the authorize
// URL like a user clicking Authorize, then GitHub redirecting back to 127.0.0.1.
const opened: string[] = [];
/** Set to hold the redirect back, so a test can keep a flow genuinely in flight. */
const browser = { hold: false, pending: [] as (() => Promise<void>)[] };
vi.mock("electron", () => ({
  shell: {
    openExternal: async (url: string) => {
      opened.push(url);
      const u = new URL(url);
      const redirect = new URL(u.searchParams.get("redirect_uri")!);
      redirect.searchParams.set("code", "one-time-code");
      redirect.searchParams.set("state", u.searchParams.get("state")!);
      const follow = async () => void (await fetch(redirect));
      if (browser.hold) browser.pending.push(follow);
      else await follow();
    },
  },
}));

import { configureNetwork } from "@main/network/axios";
import { runWebFlow } from "@main/services/auth/web-flow.service";
import type { WebFlowStatus } from "@shared/types";

let fakeGitHub: Server;
let received: Record<string, unknown> = {};

beforeAll(async () => {
  fakeGitHub = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received = JSON.parse(body);
      const ok = received.code === "one-time-code" && received.client_secret === "sekret";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          ok
            ? {
                access_token: "gho_test",
                token_type: "bearer",
                refresh_token: "ghr_test",
                expires_in: 28_800,
              }
            : { error: "bad_verification_code" },
        ),
      );
    });
  });
  await new Promise<void>((r) => fakeGitHub.listen(47941, "127.0.0.1", r));
  configureNetwork({ getToken: () => null, baseUrls: { oauth: "http://127.0.0.1:47941" } });
});

afterAll(() => fakeGitHub.close());

describe("web flow end-to-end", () => {
  it("opens the authorize page, catches the redirect and exchanges the code", async () => {
    const statuses: WebFlowStatus[] = [];
    const token = await runWebFlow({ clientId: "cid", clientSecret: "sekret" }, (s) =>
      statuses.push(s),
    );
    expect(token.accessToken).toBe("gho_test");
    // Without these an expiring token can never be renewed and the user is made to
    // authorize again the next day.
    expect(token.refreshToken).toBe("ghr_test");
    expect(token.expiresAt).toBeGreaterThan(Date.now());
    expect(statuses).toEqual(["waiting", "exchanging", "ok"]);
    expect(opened[0]).toContain("https://github.com/login/oauth/authorize?client_id=cid");
    expect(received.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:4783\d\/callback$/);
  });

  it("joins a flow already in flight instead of opening a second browser tab", async () => {
    // React StrictMode mounts the sign-in screen twice in dev. Starting a second flow
    // would issue a fresh `state`, so authorizing the first tab failed as a mismatch.
    //
    // The redirect is held back rather than racing it: without that, the first flow can
    // finish before the second call is made, and the test asserts nothing about joining.
    opened.length = 0;
    browser.hold = true;
    const config = { clientId: "cid", clientSecret: "sekret" };
    const first = runWebFlow(config, () => undefined);
    // The tab opens only after the loopback server is listening, so wait for the first
    // flow to actually be in flight — that is the state the second call has to join.
    for (let i = 0; i < 200 && opened.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(opened).toHaveLength(1);

    const second = runWebFlow(config, () => undefined);
    expect(opened).toHaveLength(1); // the second call must not have opened its own tab

    browser.hold = false;
    await Promise.all(browser.pending.splice(0).map((follow) => follow()));
    const [a, b] = await Promise.all([first, second]);
    expect(opened).toHaveLength(1);
    expect(a.accessToken).toBe("gho_test");
    expect(b).toBe(a);
  });

  it("refuses to run without a client secret", async () => {
    await expect(
      runWebFlow({ clientId: "cid", clientSecret: null }, () => undefined),
    ).rejects.toThrow(/CLIENT_SECRET/);
  });
});
