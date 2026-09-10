export interface HotkeyRecorderProps {
  value: string;
  /** Called with the new accelerator once a full combination is pressed. */
  onChange: (accelerator: string) => void | Promise<boolean | void>;
  busy?: boolean;
}
