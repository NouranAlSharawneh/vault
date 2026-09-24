import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { ASSET_SCHEME } from "@shared/constants";
import { insideVault } from "../../services/fs/paths";
import { session } from "../session/session";
import { resolveAssetRequest } from "./resolve-asset-request";

/** Must run before `app.whenReady()` — the scheme needs to look like https to the renderer. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, stream: true } },
  ]);
}

/**
 * Serve `marasca://asset/<path>` from the open vault so images and media referenced from a
 * doc render in the reader. Only paths inside the vault and only known media types.
 */
export function registerAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const where = resolveAssetRequest(
      session.vault?.root,
      new URL(request.url),
      existsSync,
      insideVault,
    );
    if ("deny" in where) return new Response(null, { status: where.deny });
    try {
      const file = await net.fetch(pathToFileURL(where.path).href);
      if (file.ok) return new Response(file.body, { headers: { "Content-Type": where.mime } });
    } catch {
      /* unreadable — fall through to 404 */
    }

    return new Response(null, { status: 404 });
  });
}
