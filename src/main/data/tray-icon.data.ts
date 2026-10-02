/**
 * The logo's 16px drawing, for the menu bar. A copy of the renderer's `LOGO_16.still`:
 * main cannot reach renderer data, and the menu bar needs no hop frames. Any letter is a
 * filled pixel; macOS paints a template image in the menu bar's own colour.
 */
export const TRAY_LOGO: readonly string[] = [
  "........S....",
  ".......S.....",
  ".......S.....",
  "......SSS....",
  "......S.SRR..",
  "......S.RRRR.",
  ".....S...RRRR",
  "....S...RRRRR",
  "LLLLL...RRRRR",
  "LLLLLL..RRRR.",
  "LL.LLLL......",
  ".LLLLLL......",
  "....LL.......",
];
