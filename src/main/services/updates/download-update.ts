import { createHash } from "node:crypto";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { net } from "electron";
import { UPDATE_STALL_MS } from "@shared/constants";

export interface DownloadProgress {
  received: number;
  /** From the response, or the size the release listed; null when neither said. */
  total: number | null;
}

/**
 * Download `url` into `file`, hashing it on the way, and resolve with its SHA-256 (hex).
 *
 * Through Electron's `net`, not the GitHub client: the asset redirects to GitHub's file
 * host, the system proxy applies, and the signed-in token is never sent along. A download
 * that receives nothing for `UPDATE_STALL_MS` is dropped rather than left hanging.
 */
export async function downloadToFile(
  url: string,
  file: string,
  onProgress: (p: DownloadProgress) => void,
  sizeHint: number | null = null,
): Promise<string> {
  const abort = new AbortController();
  let stall: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(stall);
    stall = setTimeout(() => abort.abort(), UPDATE_STALL_MS);
  };
  const out = createWriteStream(file);
  arm();
  try {
    const res = await net.fetch(url, { signal: abort.signal });
    if (!res.ok || !res.body) throw new Error(`GitHub answered ${res.status} for the download.`);
    const total = Number(res.headers.get("content-length")) || sizeHint;
    const hash = createHash("sha256");
    const reader = res.body.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      hash.update(value);
      received += value.byteLength;
      if (!out.write(value)) await once(out, "drain");
      onProgress({ received, total });
    }
    out.end();
    await once(out, "finish");

    return hash.digest("hex");
  } catch (e) {
    out.destroy();
    if (abort.signal.aborted)
      throw new Error("The download stalled. Check the connection and try again.", { cause: e });
    throw e;
  } finally {
    clearTimeout(stall);
  }
}

/** A small text file (the checksums), through the same `net` as the download. */
export async function fetchText(url: string): Promise<string> {
  const res = await net.fetch(url, { signal: AbortSignal.timeout(UPDATE_STALL_MS) });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url.split("/").pop()}.`);

  return res.text();
}
