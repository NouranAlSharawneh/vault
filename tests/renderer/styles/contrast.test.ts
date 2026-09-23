import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The palette is the one place a readability problem can hide in plain sight: every
 * section label, timestamp and count in the app is drawn in `ink-4`, at 10.5px, and it
 * used to sit at 2.4:1 against paper — quiet to the point of not reliably existing.
 *
 * These are the WCAG numbers. 4.5:1 is the threshold for text at this size.
 */
const css = readFileSync(join(process.cwd(), "src/renderer/styles/global.css"), "utf8");

const token = (name: string): string => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
  if (!m) throw new Error(`no --color-${name} in global.css`);

  return m[1];
};

const channel = (c: number): number => {
  const s = c / 255;

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);

  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
};

const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);

  return (x + 0.05) / (y + 0.05);
};

describe("palette contrast", () => {
  it.each([
    ["ink", "paper"],
    ["ink-2", "paper"],
    ["ink-3", "paper"],
    ["ink-3", "paper-2"],
    ["ink-4", "paper"],
    ["ink-4", "paper-2"],
    // Hover fills, the tag filter box and the search pill are paper-3.
    ["ink-3", "paper-3"],
    ["ink-4", "paper-3"],
    ["cherry", "paper"],
    ["cherry-2", "paper"],
    ["ok-2", "paper"],
    ["warn-2", "paper"],
    ["overlay-ink", "overlay"],
    ["overlay-ink-2", "overlay"],
    // The quiet tier on the dark surfaces: palette hints and headings, capture labels,
    // and placeholders in the capture fields, which sit on overlay-2.
    ["overlay-ink-3", "overlay"],
    ["overlay-ink-3", "overlay-2"],
    ["overlay-ink-2", "overlay-2"],
    // The tint built for dark grounds: it is what error text uses on the capture sheet.
    ["cherry-3", "overlay"],
  ])("%s on %s is readable", (ink, ground) => {
    expect(contrast(token(ink), token(ground))).toBeGreaterThanOrEqual(4.5);
  });

  // WCAG 1.4.11: a shape that has to be seen on its own — a focus ring, a filled star —
  // needs 3:1 against what is next to it.
  it.each([
    // The focus ring, on every light ground it can land on.
    ["cherry", "paper"],
    ["cherry", "paper-2"],
    ["cherry", "paper-3"],
    // …and in the dark (palette, capture sheet).
    ["cherry-3", "overlay"],
    ["cherry-3", "overlay-2"],
    // The star, on a row and on a selected row.
    ["warn-2", "paper"],
    ["warn-2", "paper-2"],
  ])("%s on %s is visible as a shape", (shape, ground) => {
    expect(contrast(token(shape), token(ground))).toBeGreaterThanOrEqual(3);
  });

  it("keeps the quiet dark tier below the one above it", () => {
    expect(contrast(token("overlay-ink-2"), token("overlay-ink-3"))).toBeGreaterThan(1.1);
    expect(luminance(token("overlay-ink-3"))).toBeLessThan(luminance(token("overlay-ink-2")));
  });

  it("keeps ink-3 and ink-4 as two distinguishable tiers", () => {
    // Fixing the contrast by collapsing the quiet tier into the loud one would be no fix.
    expect(contrast(token("ink-3"), token("ink-4"))).toBeGreaterThan(1.1);
    expect(luminance(token("ink-4"))).toBeGreaterThan(luminance(token("ink-3")));
  });

  it("keeps a readable pair beside each shapes-only colour", () => {
    // `ok` and `warn` are a diff background, a status dot and a spinner.
    // They are supposed to fail as text — that is what makes them quiet — so the palette
    // carries a readable sibling for the times a word or a number has to be that colour.
    for (const shape of ["ok", "warn"]) {
      expect(contrast(token(shape), token("paper"))).toBeLessThan(4.5);
      expect(contrast(token(`${shape}-2`), token("paper"))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
