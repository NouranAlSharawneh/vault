import type { PixelRun } from "./pixel-runs.types";

/**
 * Collapse rows of cells (`.` is empty) into horizontal runs, so a drawing renders as a
 * handful of rects instead of one per cell.
 */
export function pixelRuns(rows: readonly string[], empty = "."): PixelRun[] {
  const runs: PixelRun[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const cell = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === cell) end += 1;
      if (cell !== empty) runs.push({ x, y, width: end - x, cell });
      x = end;
    }
  });

  return runs;
}
