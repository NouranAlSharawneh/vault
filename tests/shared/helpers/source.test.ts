import { describe, expect, it } from "vitest";
import { SOURCES } from "@shared/constants";
import { isSource, toSource } from "@shared/helpers";

describe("source", () => {
  it("recognises every source the app ships", () => {
    for (const s of SOURCES) expect(isSource(s)).toBe(true);
  });

  it("does not recognise anything else", () => {
    for (const v of ["", "Claude", "banana", null, undefined, 3, {}]) {
      expect(isSource(v)).toBe(false);
    }
  });

  it("reads a source out of frontmatter case-insensitively", () => {
    expect(toSource("Claude")).toBe("claude");
    expect(toSource("GITHUB")).toBe("github");
  });

  it("falls back to `other` for anything a hand-edited file might say", () => {
    // Frontmatter is a text file the user can type into, so this has to hold for
    // absolutely anything — including the shapes that are not strings at all.
    for (const v of ["banana", "", null, undefined, 42, ["claude"], { source: "claude" }]) {
      expect(toSource(v)).toBe("other");
    }
  });
});
