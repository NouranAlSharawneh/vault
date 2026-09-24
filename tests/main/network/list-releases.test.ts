import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureNetwork } from "@main/network/axios";
import { listReleases } from "@main/network/github";

let github: Server;
let path = "";
let reply: unknown = [];

beforeAll(async () => {
  github = createServer((req, res) => {
    path = req.url ?? "";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply));
  });
  await new Promise<void>((r) => github.listen(47943, "127.0.0.1", r));
  configureNetwork({ getToken: () => null, baseUrls: { api: "http://127.0.0.1:47943" } });
});
afterAll(() => github.close());

describe("listReleases", () => {
  it("reads the release list (which includes prereleases) and drops drafts", async () => {
    reply = [
      { tag_name: "v0.0.3", html_url: "u3", draft: true, prerelease: true },
      { tag_name: "v0.0.2", html_url: "u2", draft: false, prerelease: true },
    ];
    const releases = await listReleases("o/r");
    expect(path).toMatch(/^\/repos\/o\/r\/releases\?/);
    expect(releases.map((r) => r.tag_name)).toEqual(["v0.0.2"]);
  });
});
