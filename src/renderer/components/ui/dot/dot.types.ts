export interface DotProps {
  /** A CSS colour, for project swatches whose colour is computed. */
  color?: string;
  /** A Tailwind background class, for the fixed states: bg-ok, bg-warn, bg-cherry. */
  tone?: string;
  size?: number;
  className?: string;
  /** What the dot means, when nothing beside it says so. Unlabelled dots are decorative. */
  "aria-label"?: string;
}
