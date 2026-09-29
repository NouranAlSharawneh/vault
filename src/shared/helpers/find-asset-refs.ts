import { ASSET_MIME, HTML_SRC_RE, MD_LINK_RE } from "../constants";
import { isRelativeRef } from "./is-relative-ref";
import { splitCode } from "./split-code";

/**
 * Relative image/media paths a markdown body points at (`![…](docs/hero.gif)`,
 * `<img src="…">`, and plain links to media files), de-duplicated, in order.
 */
export function findAssetRefs(markdown: string): string[] {
  const out: string[] = [];
  const add = (raw: string, mediaOnly: boolean) => {
    const target = raw.split(/[?#]/)[0];
    if (!isRelativeRef(target)) return;
    const ext = target.split(".").pop()?.toLowerCase() ?? "";
    if (mediaOnly && !(ext in ASSET_MIME)) return;
    if (!out.includes(target)) out.push(target);
  };
  // Code is left as written: an image shown as an example is not an image to fetch.
  const prose = splitCode(markdown)
    .map((s) => (s.code ? " ".repeat(s.text.length) : s.text))
    .join("");
  const found = [
    ...[...prose.matchAll(MD_LINK_RE)].map((m) => ({
      at: m.index,
      raw: unwrap(m[2]),
      mediaOnly: m[1] !== "!",
    })),
    ...[...prose.matchAll(HTML_SRC_RE)].map((m) => ({
      at: m.index,
      raw: m[2],
      mediaOnly: false,
    })),
  ].sort((a, b) => a.at - b.at);
  for (const f of found) add(f.raw, f.mediaOnly);

  return out;
}

/** `<path with spaces>` → `path with spaces`. */
export function unwrap(target: string): string {
  return target.startsWith("<") && target.endsWith(">") ? target.slice(1, -1) : target;
}
