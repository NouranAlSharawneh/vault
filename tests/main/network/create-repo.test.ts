import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureNetwork } from "@main/network/axios";
import { createRepo } from "@main/network/github";
import { CREATE_REPO_FORBIDDEN } from "@shared/constants";

/**
 * A fine-grained token scoped to one repo — the kind the token form tells people to
 * make — can't create repos. The picker needs to recognise that answer, not show
 * GitHub's raw one.
 */
let github: Server;
let reply: { status: number; body: Record<string, unknown> } = { status: 201, body: {} };

beforeAll(async () => {
  github = createServer((_req, res) => {
    res.writeHead(reply.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((r) => github.listen(0, "127.0.0.1", r));
  const { port } = github.address() as AddressInfo;
  configureNetwork({
    getToken: () => "github_pat_x",
    baseUrls: { api: `http://127.0.0.1:${port}` },
  });
});
afterAll(() => github.close());

describe("createRepo", () => {
  it("turns a token's 403 into the message the repo picker recognises", async () => {
    reply = {
      status: 403,
      body: { message: "Resource not accessible by personal access token" },
    };
    await expect(createRepo("vault", true)).rejects.toMatchObject({
      message: CREATE_REPO_FORBIDDEN,
      status: 403,
    });
  });

  it("leaves a rate-limit 403 saying what it is", async () => {
    reply = { status: 403, body: { message: "API rate limit exceeded for user ID 1." } };
    await expect(createRepo("vault", true)).rejects.toMatchObject({
      message: "API rate limit exceeded for user ID 1.",
    });
  });

  it("passes other failures through untouched", async () => {
    reply = { status: 422, body: { message: "Repository creation failed." } };
    await expect(createRepo("vault", true)).rejects.toMatchObject({
      message: "Repository creation failed.",
      status: 422,
    });
  });
});
