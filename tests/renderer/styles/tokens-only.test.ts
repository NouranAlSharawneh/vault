import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every colour, size and grid in the renderer comes from a token or a named utility in
 * global.css. An arbitrary value (`max-w-[92vw]`, `to-[#121211]`) or a raw white/black is
 * a colour or a size the theme doesn't know about — the kind that drifts from its
 * neighbours and fails contrast unnoticed. There were fourteen.
 */
const root = join(process.cwd(), "src/renderer");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);

    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const ARBITRARY = /\b[a-z][a-z0-9:/-]*-\[[^\]\s]+\]/g;
const RAW_COLOUR =
  /\b(?:[a-z]+:)*(?:text|bg|border|from|to|via|fill|stroke|ring)-(?:white|black)\b/g;

describe("renderer classes", () => {
  it.each([
    ["arbitrary values", ARBITRARY],
    ["raw white or black", RAW_COLOUR],
  ])("use no %s", (_, pattern) => {
    const found = files(root).flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(pattern)].map(
        (m) => `${relative(root, path)}: ${m[0]}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
