export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** ⌘↵ / Ctrl↵ inside the editor. */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  dark?: boolean;
  className?: string;
}
