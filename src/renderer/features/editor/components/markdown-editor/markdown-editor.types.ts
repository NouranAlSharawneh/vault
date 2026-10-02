export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** ⌘↵ / Ctrl↵ inside the editor. */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** No typing, e.g. while a save is on its way. */
  readOnly?: boolean;
  dark?: boolean;
  className?: string;
}
