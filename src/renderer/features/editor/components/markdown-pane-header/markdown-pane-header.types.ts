export interface MarkdownPaneHeaderProps {
  words: number;
  /** Words in the selection; 0 when nothing is selected. */
  selectedWords: number;
  focusMode: boolean;
  onFocusMode: () => void;
  onShortcuts: () => void;
}
