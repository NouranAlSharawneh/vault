import { createServer, type Server } from "node:http";
import { callbackPage } from "./callback-page";
import type { LoopbackOptions, LoopbackServer } from "./loopback-server.types";

/**
 * One-shot HTTP listener on 127.0.0.1 that receives GitHub's redirect. Tries the
 * configured ports in order (the first must match the OAuth App's callback URL).
 */
export async function startLoopbackServer(opts: LoopbackOptions): Promise<LoopbackServer> {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;
  const code = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });
  // Callers may cancel before the promise is observed; keep Node quiet about it.
  code.catch(() => undefined);

  let settled = false;
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    fn();
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${opts.host}`);
    if (url.pathname !== opts.path) {
      res.writeHead(404).end();
      return;
    }
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");
    const authCode = url.searchParams.get("code");
    let ok = false;
    let detail: string | undefined;
    if (error) detail = url.searchParams.get("error_description") ?? error;
    else if (state !== opts.state) detail = "state mismatch";
    else if (!authCode) detail = "missing code";
    else ok = true;
    res
      .writeHead(ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" })
      .end(callbackPage(ok, detail));
    settle(() => (ok ? resolveCode(authCode!) : rejectCode(new Error(detail))));
  });

  const timer = setTimeout(() => {
    settle(() => rejectCode(new Error("timeout")));
    server.close();
  }, opts.timeoutMs);
  const port = await listenOnFirstFree(server, opts.host, opts.ports).catch((e: unknown) => {
    clearTimeout(timer);
    throw e;
  });

  const close = () => {
    settle(() => rejectCode(new Error("cancelled")));
    server.close();
  };

  return { port, redirectUri: `http://${opts.host}:${port}${opts.path}`, code, close };
}

function listenOnFirstFree(
  server: Server,
  host: string,
  ports: readonly number[],
): Promise<number> {
  return new Promise((resolve, reject) => {
    let i = 0;
    const onError = (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE" && ++i < ports.length) {
        server.listen(ports[i], host);
        return;
      }
      server.off("error", onError);
      reject(e.code === "EADDRINUSE" ? new Error(`No free port among ${ports.join(", ")}`) : e);
    };
    server.on("error", onError);
    server.once("listening", () => {
      server.off("error", onError);
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : ports[i]);
    });
    server.listen(ports[i], host);
  });
}
