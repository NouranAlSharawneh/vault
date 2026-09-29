export interface ProjectComboboxProps {
  value: string;
  onChange: (project: string) => void;
  projects: string[];
  dark?: boolean;
  /** Small caption on the right, e.g. "last used". */
  hint?: string;
  /** Where the list opens. The capture sheet grows to fit a list below; above, it was cut off. */
  placement?: "above" | "below";
  /** Projects that have a ⌘1–⌘9 shortcut, in order: each row shows its own. */
  shortcuts?: string[];
  /** The field's id, for the <label> that names it. */
  id?: string;
}
