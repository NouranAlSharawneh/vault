import { WORDS_PER_MINUTE } from "@shared/constants";

export function readTime(words: number): string {
  return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`;
}
