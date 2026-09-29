export interface ProjectComboboxProps {
  value: string;
  onChange: (project: string) => void;
  projects: string[];
  dark?: boolean;
  /** Small caption on the right, e.g. "last used". */
  hint?: string;
  /** Where the list opens. The capture sheet grows to fit a list below; above, it was cut off. */
  placement?: "above" | "below";
}
