export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What it turns on, for screen readers when no visible label names it. */
  label: string;
  disabled?: boolean;
  busy?: boolean;
}
