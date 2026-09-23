import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Someone who has asked the system for less motion gets fades, not rises and overshoots. */
const css = readFileSync(join(process.cwd(), "src/renderer/styles/global.css"), "utf8");
const block = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const still = /@keyframes fade-in-still \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

describe("reduced motion", () => {
  it("swaps the pop-in and fade-in for an opacity-only fade", () => {
    expect(block).toMatch(/\.animate-fade-in,\s*\.animate-pop-in \{\s*animation: fade-in-still /);
    expect(still).toContain("opacity");
    expect(still).not.toContain("transform");
  });

  it("slows the spinner rather than stopping it", () => {
    expect(block).toMatch(/\.animate-spin-fast \{\s*animation-duration: \d/);
  });
});
