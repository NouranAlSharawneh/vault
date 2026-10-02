import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Electron's `net.fetch` is the WHATWG fetch over Chromium; Node's stands in for it.
vi.mock("electron", () => ({ net: { fetch: (...a: Parameters<typeof fetch>) => fetch(...a) } }));
vi.mock("@shared/constants", async (original) => ({
  ...(await original<object>()),
  UPDATE_STALL_MS: 300,
}));

import { downloadToFile, fetchText } from "@main/services/updates/download-update";

const BODY = Buffer.alloc(256 * 1024, 7);
let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/file") {
      res.writeHead(200, { "Content-Length": BODY.length });
      res.end(BODY);
    } else if (req.url === "/stall") {
      // Headers, a first chunk, then nothing at all.
      res.writeHead(200, { "Content-Length": BODY.length });
      res.write(BODY.subarray(0, 1024));
    } else if (req.url === "/sums") {
      res.end("hash  name\n");
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const tmp = () => mkdtempSync(join(tmpdir(), "marasca-download-test-"));

describe("downloadToFile", () => {
  it("writes the file, reports progress against its size, and answers its SHA-256", async () => {
    const file = join(tmp(), "Marasca.dmg");
    const progress: { received: number; total: number | null }[] = [];
    const hash = await downloadToFile(`${base}/file`, file, (p) => progress.push(p));
    expect(hash).toBe(createHash("sha256").update(BODY).digest("hex"));
    expect(readFileSync(file).equals(BODY)).toBe(true);
    expect(progress.at(-1)).toEqual({ received: BODY.length, total: BODY.length });
  });

  it("says what GitHub answered when it isn't the file", async () => {
    await expect(downloadToFile(`${base}/gone`, join(tmp(), "x"), () => undefined)).rejects.toThrow(
      /404/,
    );
  });

  it("gives up on a download that stops arriving", async () => {
    await expect(
      downloadToFile(`${base}/stall`, join(tmp(), "x"), () => undefined),
    ).rejects.toThrow(/stalled/);
  });
});

describe("fetchText", () => {
  it("reads the checksums file", async () => {
    expect(await fetchText(`${base}/sums`)).toBe("hash  name\n");
  });
});
