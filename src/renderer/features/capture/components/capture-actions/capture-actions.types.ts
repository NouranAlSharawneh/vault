export interface CaptureAction {
  id: string;
  label: string;
  /** The chord that does the same thing without the menu, as shown on the key cap. */
  keys: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

export interface CaptureActionsProps {
  actions: CaptureAction[];
  onClose: () => void;
}
