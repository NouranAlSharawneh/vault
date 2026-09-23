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
  const path = docAssetPath(h, docPath);
  if (path && /\.(?:md|markdown)$/i.test(path)) {
    return { kind: "doc", path: path.split("/").map(decode).join("/") };
  }

  return { kind: "none" };
}
