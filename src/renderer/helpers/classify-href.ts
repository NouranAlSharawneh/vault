import { TRASH_DIR } from "@shared/constants";
import { docAssetPath } from "@shared/helpers";
import type { LinkTarget } from "./classify-href.types";

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Sort a markdown link by what a click on it should do. Relative paths resolve the way
 * GitHub resolves them, against the linking document's folder with `/` as the repo root,
 * so a link that works on github.com works here too.
 */
export function classifyHref(href: string, docPath: string): LinkTarget {
  const h = href.trim();
  if (h.startsWith("#")) {
    const id = decode(h.slice(1));

    return id ? { kind: "anchor", id } : { kind: "none" };
  }
  if (/^(?:https?:\/\/|mailto:)/i.test(h)) return { kind: "external", url: h };
  // A trashed document's links mean what they meant where it lived: resolved against
  // `.trash/…` they pointed at nothing, and every one said "isn't in the vault".
  const from = docPath.startsWith(`${TRASH_DIR}/`) ? docPath.slice(TRASH_DIR.length + 1) : docPath;
  const path = docAssetPath(h, from);
  if (path && /\.(?:md|markdown)$/i.test(path)) {
    const hash = decode(h.split("#")[1] ?? "");

    return {
      kind: "doc",
      path: path.split("/").map(decode).join("/"),
      ...(hash ? { hash } : {}),
    };
  }

  return { kind: "none" };
}
