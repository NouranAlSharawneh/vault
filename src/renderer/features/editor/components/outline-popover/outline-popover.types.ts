import type { Heading } from "@/helpers";

export interface OutlinePopoverProps {
  headings: Heading[];
  /** A heading was chosen: go to its line. */
  onJump: (line: number) => void;
  onClose: () => void;
}
