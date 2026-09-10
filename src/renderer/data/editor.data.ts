import type { Source } from "@shared/types";

export interface SourceOption {
  value: Source;
  label: string;
}

export const SOURCE_OPTIONS: SourceOption[] = [
  { value: "claude", label: "Claude" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "github", label: "GitHub" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

export const EDITOR_PLACEHOLDER = "# Title\n\nPaste or write markdown…";
