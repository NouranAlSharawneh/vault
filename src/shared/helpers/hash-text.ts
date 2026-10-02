/**
 * A short, stable fingerprint of some text (32-bit FNV-1a, as hex). For telling one clip
 * from another in memory — not for anything that has to resist a collision on purpose.
 */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return (h >>> 0).toString(16).padStart(8, "0");
}
