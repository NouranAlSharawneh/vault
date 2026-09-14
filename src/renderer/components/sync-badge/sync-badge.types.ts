export interface SyncBadgeProps {
  className?: string;
  /**
   * Opens the review of documents that changed in two places. Given only by the window
   * that has somewhere to show it — without it a conflict still reads, it just doesn't click.
   */
  onReviewConflicts?: () => void;
}
