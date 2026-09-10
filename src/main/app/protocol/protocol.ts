import { net, protocol } from "electron";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { ASSET_HOST, ASSET_MIME, ASSET_SCHEME } from "@shared/constants";
import { session } from "../session/session";

/** Must run before `app.whenReady()` — the scheme needs to look like https to the renderer. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, stream: true } },
  ]);
}

/**
 * Serve `vault://asset/<path>` from the open vault so images and media referenced from a
 * doc render in the reader. Only paths inside the vault and only known media types.
 */
export function registerAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const url = new URL(request.url);
    const root = session.vault?.root;
    if (url.host !== ASSET_HOST || !root) return new Response(null, { status: 404 });
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const abs = resolve(join(root, rel));
    const inside = abs === root || abs.startsWith(root.endsWith(sep) ? root : root + sep);
    const mime = ASSET_MIME[abs.split(".").pop()?.toLowerCase() ?? ""];
    if (!inside || !mime || rel.split("/").includes(".git")) {
      return new Response(null, { status: 403 });
    }
    const file = await net.fetch(pathToFileURL(abs).href);
    if (!file.ok) return new Response(null, { status: 404 });
    return new Response(file.body, { headers: { "Content-Type": mime } });
  });
}
