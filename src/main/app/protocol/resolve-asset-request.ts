import { join } from "node:path";
import { ASSET_HOST, ASSET_MIME, TRASH_DIR } from "@shared/constants";

export type AssetResolution = { deny: number } | { path: string; mime: string };

/**
 * What `vault://asset/<path>` should serve, decided before anything is read. Split from
 * the protocol handler so the rules — inside the vault, a known media type, never the
 * repo's own `.git/` — can be tested without an Electron session.
 *
 * `exists` is injected so the trash fallback can be exercised: a trashed document still
 * points at `assets/…` next to where it used to live, so both paths are tried in order.
 */
export function resolveAssetRequest(
  root: string | undefined,
  url: URL,
  exists: (path: string) => boolean,
  insideVault: (root: string, rel: string) => string | null,
): AssetResolution {
  if (url.host !== ASSET_HOST || !root) return { deny: 404 };
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const abs = insideVault(root, rel);
  const mime = abs ? ASSET_MIME[abs.split(".").pop()?.toLowerCase() ?? ""] : undefined;
  if (!abs || !mime || rel.split("/").includes(".git")) return { deny: 403 };

  const candidates = [abs];
  if (rel.startsWith(`${TRASH_DIR}/`)) candidates.push(join(root, rel.slice(TRASH_DIR.length + 1)));
  const found = candidates.find(exists);

  return found ? { path: found, mime } : { deny: 404 };
}
