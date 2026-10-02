export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing tags for autocomplete. */
  suggestions: string[];
  dark?: boolean;
  placeholder?: string;
  /** Where the list opens. The capture sheet grows to fit a list below; above, it was cut off. */
  placement?: "above" | "below";
}
