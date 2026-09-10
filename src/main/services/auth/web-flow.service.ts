import { randomBytes } from "node:crypto";
import { shell } from "electron";
import {
  OAUTH_CALLBACK_PATH,
  OAUTH_LOOPBACK_HOST,
  OAUTH_LOOPBACK_PORTS,
  OAUTH_TIMEOUT_MS,
} from "@shared/constants";
import { buildAuthorizeUrl, exchangeCode } from "../../network/github";
import type { OAuthConfig } from "../../store/oauth-config.types";
import type { WebFlowReporter } from "./web-flow.types";
import { startLoopbackServer } from "./loopback-server";

let active: { close: () => void } | null = null;

/**
 * OAuth "authorization code" flow for a desktop app: open the browser to GitHub's
 * Authorize page, catch the redirect on 127.0.0.1, exchange the code for a token.
 */
export async function runWebFlow(config: OAuthConfig, report: WebFlowReporter): Promise<string> {
  if (!config.clientSecret)
    throw new Error("Web flow needs MAIN_VITE_GITHUB_CLIENT_SECRET (see .env.example)");
  cancelWebFlow();
  const state = randomBytes(16).toString("hex");
  const server = await startLoopbackServer({
    state,
    ports: OAUTH_LOOPBACK_PORTS,
    host: OAUTH_LOOPBACK_HOST,
    path: OAUTH_CALLBACK_PATH,
    timeoutMs: OAUTH_TIMEOUT_MS,
  });
  active = server;
  try {
    report("waiting");
    await shell.openExternal(
      buildAuthorizeUrl({ clientId: config.clientId, redirectUri: server.redirectUri, state }),
    );
    const code = await server.code;
    report("exchanging");
    const token = await exchangeCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: server.redirectUri,
    });
    report("ok");
    return token;
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
    if (active === server) active = null;
  }
}

export function cancelWebFlow(): void {
  active?.close();
  active = null;
}
