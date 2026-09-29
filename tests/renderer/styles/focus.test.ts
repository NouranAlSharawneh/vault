import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keyboard focus has to be visible everywhere. The one authored ring lives in
 * global.css; the ways it used to go missing were a ring in a tint that disappears on
 * paper (1.1:1), a dark variant with no ring at all, and a bare `outline-none`.
 */
const root = join(process.cwd(), "src/renderer");
const css = readFileSync(join(root, "styles/global.css"), "utf8");

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);

    return /\.(tsx|css)$/.test(name) ? [path] : [];
  });

describe("focus indicator", () => {
  it("draws one cherry ring for keyboard focus, and cherry-3 on dark surfaces", () => {
    expect(css).toMatch(/:focus-visible[^{]*\{\s*outline: 2px solid var\(--color-cherry\);/);
    expect(css).toMatch(/\.dark :focus-visible[^{]*\{\s*outline-color: var\(--color-cherry-3\);/);
  });

  it("leaves the editor's text surface and script-only focus targets alone", () => {
    expect(css).toMatch(/:focus-visible:where\(:not\(\.cm-content, \[tabindex="-1"\]\)\)/);
  });

  it("rings a field that holds its own input, in the colour its surface needs", () => {
    // Project, source and tags wrap their input: the ring is on the box, via focus-within,
    // and the capture sheet's dark fields take cherry-3 like every dark ring.
    expect(css).toMatch(/\.field \{[^}]*focus-within:ring-2 focus-within:ring-cherry;/);
    expect(css).toMatch(/\.dark \.field \{[^}]*focus-within:ring-cherry-3;/);
  });

  it("never paints a focus ring in the tint that cannot be seen on paper", () => {
    for (const file of sources(root)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/(focus|focus-within):ring-cherry-tint/);
    }
  });
});
