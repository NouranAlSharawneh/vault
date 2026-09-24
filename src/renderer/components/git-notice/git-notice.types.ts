export interface GitNoticeProps {
  /** Render nothing once git works, for places that only care when it doesn't. */
  hideWhenReady?: boolean;
  className?: string;
}
