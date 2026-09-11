import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { configureNetwork } from "@main/network/axios";
import { refreshAccessToken } from "@main/network/github";

/**
 * The renewal that is supposed to stop an 8-hour token turning into a sign-out. Until
 * this existed the path had never actually been exercised — only the mapping around it.
 */
let github: Server;
let received: Record<string, unknown> = {};
let reply: Record<string, unknown> = {};

beforeAll(async () => {
  github = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((r) => github.listen(47942, "127.0.0.1", r));
  configureNetwork({ getToken: () => null, baseUrls: { oauth: "http://127.0.0.1:47942" } });
});
afterAll(() => github.close());

describe("refreshAccessToken", () => {
  it("asks GitHub the way the refresh grant requires", async () => {
    reply = { access_token: "gho_new", refresh_token: "ghr_new", expires_in: 28_800 };
    await refreshAccessToken({ clientId: "cid", clientSecret: "sekret", refreshToken: "ghr_old" });
    expect(received).toMatchObject({
      client_id: "cid",
      client_secret: "sekret",
      grant_type: "refresh_token",
      refresh_token: "ghr_old",
    });
  });

  it("keeps the rotated refresh token — GitHub issues a new one each time", async () => {
    // Storing the old one would work once and then lock the user out for good.
    reply = { access_token: "gho_new", refresh_token: "ghr_new", expires_in: 28_800 };
    const creds = await refreshAccessToken({
      clientId: "cid",
      clientSecret: "sekret",
      refreshToken: "ghr_old",
    });
    expect(creds.accessToken).toBe("gho_new");
    expect(creds.refreshToken).toBe("ghr_new");
    expect(creds.expiresAt).toBeGreaterThan(Date.now());
  });

  it("surfaces a refusal as an auth error rather than pretending it worked", async () => {
    reply = { error: "bad_refresh_token" };
    await expect(
      refreshAccessToken({ clientId: "cid", clientSecret: "sekret", refreshToken: "stale" }),
    ).rejects.toThrow(/bad_refresh_token/);
  });
});
