import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureNetwork } from "@main/network/axios";
import { pollDeviceFlow } from "@main/network/github";
import type { DevicePollStatus } from "@shared/types";

/**
 * Every way the poll can end has to reach the card as a status. A failure that only
 * threw left the renderer spinning "Waiting for you to approve…" for good.
 */
let github: Server;
let replies: { status: number; body: Record<string, unknown>; arrived?: () => void }[] = [];

beforeAll(async () => {
  github = createServer((_req, res) => {
    const r = replies.shift() ?? { status: 200, body: { error: "authorization_pending" } };
    r.arrived?.();
    res.writeHead(r.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r.body));
  });
  await new Promise<void>((r) => github.listen(0, "127.0.0.1", r));
  const { port } = github.address() as AddressInfo;
  configureNetwork({ getToken: () => null, baseUrls: { oauth: `http://127.0.0.1:${port}` } });
});
afterAll(() => github.close());

const poll = (signal = new AbortController().signal) => {
  const seen: DevicePollStatus[] = [];
  const done = pollDeviceFlow("cid", "dc", 0, signal, (s) => seen.push(s));

  return { seen, done };
};

describe("pollDeviceFlow", () => {
  it("reports an error GitHub names but the flow doesn't know", async () => {
    replies = [
      { status: 200, body: { error: "authorization_pending" } },
      { status: 200, body: { error: "incorrect_client_credentials" } },
    ];
    const { seen, done } = poll();
    await expect(done).rejects.toThrow("incorrect_client_credentials");
    expect(seen).toEqual(["pending", "error"]);
  });

  it("reports a request that fails outright", async () => {
    replies = [{ status: 500, body: {} }];
    const { seen, done } = poll();
    await expect(done).rejects.toBeTruthy();
    expect(seen).toEqual(["error"]);
  });

  it("still reports an expired code as expired", async () => {
    replies = [{ status: 200, body: { error: "expired_token" } }];
    const { seen, done } = poll();
    await expect(done).rejects.toBeTruthy();
    expect(seen).toEqual(["expired"]);
  });

  it("says nothing about a request that fails after cancelling — a newer attempt may be listening", async () => {
    const abort = new AbortController();
    replies = [{ status: 500, body: {}, arrived: () => abort.abort() }];
    const { seen, done } = poll(abort.signal);
    await expect(done).rejects.toBeTruthy();
    expect(seen).toEqual([]);
  });
});
