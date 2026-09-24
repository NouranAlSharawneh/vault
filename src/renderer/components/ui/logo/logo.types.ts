/** A drawn cell: `L` landed cherry, `R` flying cherry, `S` stem. */
export type LogoCell = "L" | "R" | "S";

/** One drawing as rows of cells (`.` is empty). */
export type LogoRows = readonly string[];

export interface LogoGrid {
  still: LogoRows;
  /** The hop: frames and the resting pose, cropped together so the mark doesn't shift. */
  hop?: { rest: LogoRows; frames: readonly LogoRows[] };
}

export interface LogoProps {
  size?: number;
  /** `brand` uses the cherry colours; `mono` draws everything in `currentColor`. */
  tone?: "brand" | "mono";
  /** Play the hop a couple of times, then rest. Only the large drawing has frames. */
  bounce?: boolean;
  className?: string;
}
