import { nativeImage, type NativeImage } from "electron";
import { TRAY_LOGO } from "../../data/tray-icon.data";

/** Points on a side: the menu bar's usual icon box. */
const TRAY_POINTS = 16;

/**
 * The logo as raw BGRA pixels, `scale` device pixels per cell, centred in a square of
 * `TRAY_POINTS * scale`. Black where the drawing is, transparent elsewhere — the shape a
 * template image wants.
 */
export function trayBitmap(rows: readonly string[] = TRAY_LOGO, scale = 2): Buffer {
  const side = TRAY_POINTS * scale;
  const left = Math.floor((side - rows[0].length * scale) / 2);
  const top = Math.floor((side - rows.length * scale) / 2);
  const out = Buffer.alloc(side * side * 4);
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === ".") return;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          // B, G and R stay 0: black. Only the alpha is set.
          out[((top + y * scale + dy) * side + left + x * scale + dx) * 4 + 3] = 255;
        }
      }
    });
  });

  return out;
}

/** The menu bar icon: drawn at 2× and marked as a template on macOS. */
export function trayImage(): NativeImage {
  const scale = 2;
  const side = TRAY_POINTS * scale;
  const image = nativeImage.createFromBitmap(trayBitmap(TRAY_LOGO, scale), {
    width: side,
    height: side,
    scaleFactor: scale,
  });
  if (process.platform === "darwin") image.setTemplateImage(true);

  return image;
}
