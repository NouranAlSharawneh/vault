export interface FindBarProps {
  query: string;
  onQuery: (query: string) => void;
  /** How many matches, and which one is current (1-based; 0 when there are none). */
  count: number;
  current: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}
