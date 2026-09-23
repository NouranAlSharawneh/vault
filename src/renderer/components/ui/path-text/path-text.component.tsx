import { cx } from "@/helpers";
import type { PathTextProps } from "./path-text.types";

/**
 * A file path on one line. When it doesn't fit, the start is cut rather than the end: the
 * folder name is what says where the vault lives. The full path is a hover away.
 *
 * Right-to-left puts the ellipsis on the left; the inner `bdi` keeps the characters in
 * their usual order so `/Users/…` doesn't come out as `…/Users/`.
 */
export function PathText({ path, className }: PathTextProps) {
  return (
    <span dir="rtl" title={path} className={cx("min-w-0 truncate text-left font-mono", className)}>
      <bdi dir="ltr">{path}</bdi>
    </span>
  );
}
