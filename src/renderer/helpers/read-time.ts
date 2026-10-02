import { WORDS_PER_MINUTE } from "@shared/constants";

/** Minutes to read `words`, never less than one. */
export function readMinutes(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function readTime(words: number): string {
  return `${readMinutes(words)} min read`;
}
