import { HTML_SRC_RE, MD_LINK_RE } from "../constants";
import { unwrap } from "./find-asset-refs";
import { splitCode } from "./split-code";

/**
 * Replace referenced paths (as found by `findAssetRefs`) with their new locations — in the
 * prose only; code keeps what it shows.
 */
export function rewriteAssetRefs(markdown: string, map: Record<string, string>): string {
  return splitCode(markdown)
    .map((s) => (s.code ? s.text : rewriteProse(s.text, map)))
    .join("");
}

function rewriteProse(markdown: string, map: Record<string, string>): string {
  const swap = (raw: string) => {
    const [target, ...rest] = raw.split(/([?#].*)/s);
    const next = map[target];

    return next ? next + rest.join("") : raw;
  };

  return markdown
    .replace(MD_LINK_RE, (whole, _bang: string, target: string) => {
      const bare = unwrap(target);
      const next = swap(bare);

      return next === bare ? whole : whole.replace(target, /\s/.test(next) ? `<${next}>` : next);
    })
    .replace(
      HTML_SRC_RE,
      (_whole, pre: string, target: string, post: string) => pre + swap(target) + post,
    );
}
