import { FM_CLOSE, FM_OPEN } from "../constants";

/** Byte offset where the body starts, so a streaming reader can stop early. Null when no block. */
export function frontmatterEndOffset(head: string): number | null {
  const open = FM_OPEN.exec(head);
  if (!open) return null;
  const rest = head.slice(open[0].length);
  const close = FM_CLOSE.exec(rest);
  if (!close) return null;
  return open[0].length + close.index + close[0].length;
}
