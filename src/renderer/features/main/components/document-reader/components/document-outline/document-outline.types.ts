export interface OutlineHeading {
  /** The heading's id in the rendered document (prefixed, as the sanitizer leaves it). */
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

export interface DocumentOutlineProps {
  headings: OutlineHeading[];
  onPick: (id: string) => void;
  onClose: () => void;
}
