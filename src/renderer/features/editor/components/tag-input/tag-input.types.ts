export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing tags for autocomplete. */
  suggestions: string[];
  dark?: boolean;
  placeholder?: string;
}
