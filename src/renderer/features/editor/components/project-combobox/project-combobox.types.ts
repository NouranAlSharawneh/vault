export interface ProjectComboboxProps {
  value: string;
  onChange: (project: string) => void;
  projects: string[];
  dark?: boolean;
  /** Small caption on the right, e.g. "last used". */
  hint?: string;
}
