export type EditorPanel = "outline" | "shortcuts";

export interface EditorPanelsProps {
  /** Which one is open, if any. */
  panel: EditorPanel | null;
  /** The text, for the outline's headings. */
  body: string;
  onJump: (line: number) => void;
  onClose: () => void;
}
