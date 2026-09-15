import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { ASSET_HOST, ASSET_MIME, ASSET_SCHEME, TRASH_DIR } from "@shared/constants";
import { insideVault } from "../../services/fs/paths";
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
    const abs = insideVault(root, rel);
    const mime = abs ? ASSET_MIME[abs.split(".").pop()?.toLowerCase() ?? ""] : undefined;

    if (!abs || !mime || rel.split("/").includes(".git")) {
      return new Response(null, { status: 403 });
    }
    // A trashed doc still points at `assets/…` next to where it used to live.
    const candidates = [abs];
    if (rel.startsWith(`${TRASH_DIR}/`)) {
      candidates.push(join(root, rel.slice(TRASH_DIR.length + 1)));
    }
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        const file = await net.fetch(pathToFileURL(path).href);
        if (file.ok) return new Response(file.body, { headers: { "Content-Type": mime } });
      } catch {
        /* unreadable — fall through to 404 */
      }
    }

    return new Response(null, { status: 404 });
  });
}
