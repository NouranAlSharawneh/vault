import type { RenameHint } from "@/helpers";

export interface TitleFieldProps {
  value: string;
  /** The title the first heading gives, shown while the field is empty. */
  inferredTitle: string;
  onChange: (title: string) => void;
  /** Where the next save puts a saved document, when that is not where it is now. */
  renameTo: RenameHint | null;
}
