import type { PUSH_DEBOUNCE_OPTIONS } from "@shared/constants";

export interface PushDebounceOption {
  ms: (typeof PUSH_DEBOUNCE_OPTIONS)[number];
  label: string;
}

/** How long to wait after a commit before pushing. */
export const PUSH_DEBOUNCE_LABELS: PushDebounceOption[] = [
  { ms: 0, label: "Right away" },
  { ms: 3000, label: "After 3 seconds" },
  { ms: 10_000, label: "After 10 seconds" },
  { ms: 30_000, label: "After 30 seconds" },
];
