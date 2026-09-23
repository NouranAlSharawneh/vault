export interface OpenFailedProps {
  /** The document that could not be read. */
  path: string;
  /** What reading it said, as the filesystem put it. */
  reason: string;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}
