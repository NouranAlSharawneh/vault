import { randomBytes } from "node:crypto";
import { shell } from "electron";
import {
  OAUTH_CALLBACK_PATH,
  OAUTH_LOOPBACK_HOST,
  OAUTH_LOOPBACK_PORTS,
  OAUTH_TIMEOUT_MS,
  WEB_FLOW_CANCEL_GRACE_MS,
} from "@shared/constants";
import { fire } from "../../lib/fire";
import { buildAuthorizeUrl, exchangeCode } from "../../network/github";
import type { OAuthConfig } from "../../store/oauth-config.types";
import type { StoredCredentials } from "../../store/token.store.types";
import { startLoopbackServer } from "./loopback-server";
import type { WebFlowReporter } from "./web-flow.types";

interface Flow {
  close: () => void;
  promise: Promise<StoredCredentials>;
}

let active: Flow | null = null;
let graceTimer: NodeJS.Timeout | null = null;

/**
 * OAuth "authorization code" flow for a desktop app: open the browser to GitHub's
 * Authorize page, catch the redirect on 127.0.0.1, exchange the code for a token.
 */
export async function runWebFlow(
  config: OAuthConfig,
  report: WebFlowReporter,
): Promise<StoredCredentials> {
  const clientSecret = config.clientSecret;
  if (!clientSecret)
    throw new Error("Web flow needs MAIN_VITE_GITHUB_CLIENT_SECRET (see .env.example)");
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  // React StrictMode mounts the sign-in screen twice in dev, and people double-click.
  // A second flow would issue a fresh `state` and open a second tab, so authorizing the
  // first one came back as "state mismatch". Registered before the first await so two
  // calls in the same tick can't both get past this.
  if (active) return active.promise;
  const flow: Flow = { close: () => undefined, promise: undefined! };
  active = flow;

  flow.promise = (async () => {
    const state = randomBytes(16).toString("hex");
    const server = await startLoopbackServer({
      state,
      ports: OAUTH_LOOPBACK_PORTS,
      host: OAUTH_LOOPBACK_HOST,
      path: OAUTH_CALLBACK_PATH,
      timeoutMs: OAUTH_TIMEOUT_MS,
    });
    flow.close = server.close;
    try {
      report("waiting");
      await shell.openExternal(
        buildAuthorizeUrl({ clientId: config.clientId, redirectUri: server.redirectUri, state }),
      );
      const code = await server.code;
      report("exchanging");
      const credentials = await exchangeCode({
        clientId: config.clientId,
        clientSecret,
        code,
        redirectUri: server.redirectUri,
      });
      report("ok");

      return credentials;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status =
        msg === "cancelled"
          ? "cancelled"
          : msg === "timeout"
            ? "timeout"
            : msg === "access_denied"
              ? "denied"
              : "error";
      report(status, msg);
      throw e;
    } finally {
      server.close();
    }
  })();

  flow.promise.catch(() => undefined);
  fire(
    flow.promise.finally(() => {
      if (active === flow) active = null;
    }),
    "finishing the sign-in",
  );

  return flow.promise;
}

/**
 * Cancel is deferred: StrictMode's cleanup fires between its two mounts, and tearing the
 * flow down there would kill the tab the user is about to authorize in. A genuine cancel
 * lands a moment later, which nobody notices.
 */
export function cancelWebFlow(): void {
  if (!active || graceTimer) return;
  graceTimer = setTimeout(() => {
    graceTimer = null;
    active?.close();
    active = null;
  }, WEB_FLOW_CANCEL_GRACE_MS);
}
