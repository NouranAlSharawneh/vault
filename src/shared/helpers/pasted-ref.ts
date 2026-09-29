import { PASTED_IMAGE_EXTENSIONS } from "../constants";

const PASTED = new RegExp(`^paste-[0-9a-f]{8,32}\\.(?:${PASTED_IMAGE_EXTENSIONS.join("|")})$`);

/**
 * An image pasted or dropped into the editor, before its document is saved: a bare
 * `paste-<id>.<ext>` that main keeps in app data until a save copies it into the
 * document's `assets/` and rewrites the link. Nothing else is ever taken for one.
 */
export function isPastedRef(ref: string): boolean {
  return PASTED.test(ref);
}
