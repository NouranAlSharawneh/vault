import { describe, expect, it } from "vitest";
import { diffStat, parseUnifiedDiff } from "@/helpers";

const DIFF = `diff --git a/atlas-api/spec.md b/atlas-api/spec.md
index 83db48f..bf269f4 100644
--- a/atlas-api/spec.md
+++ b/atlas-api/spec.md
@@ -1,6 +1,7 @@ Rate limiting
 # Spec
 
-We rate-limit in the app layer.
+We rate-limit at the edge.
+A new line.
 
 ## Next
 more
`;

describe("parseUnifiedDiff", () => {
  it("keeps the hunk heading and drops the file preamble", () => {
    const hunks = parseUnifiedDiff(DIFF);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].heading).toBe("Rate limiting");
    // `diff --git`, `index`, `---` and `+++` are noise the drawer already shows.
    expect(hunks[0].lines.some((l) => l.text.startsWith("diff --git"))).toBe(false);
    expect(hunks[0].lines.some((l) => l.text.includes("83db48f"))).toBe(false);
  });

  it("types each line and numbers both sides", () => {
    const [hunk] = parseUnifiedDiff(DIFF);
    const removed = hunk.lines.find((l) => l.kind === "removed")!;
    expect(removed.text).toBe("We rate-limit in the app layer.");
    expect(removed.newLine).toBeNull();
    expect(removed.oldLine).toBe(3);

    const added = hunk.lines.filter((l) => l.kind === "added");
    expect(added.map((l) => l.text)).toEqual(["We rate-limit at the edge.", "A new line."]);
    expect(added[0].oldLine).toBeNull();
    expect(added[0].newLine).toBe(3);
    // Numbering keeps walking after the change, not restarting.
    expect(added[1].newLine).toBe(4);
  });

  it("counts what changed", () => {
    expect(diffStat(parseUnifiedDiff(DIFF))).toEqual({ added: 2, removed: 1 });
  });

  it("handles several hunks and an empty diff", () => {
    const two = parseUnifiedDiff("@@ -1 +1 @@\n-a\n+b\n@@ -9,2 +9,2 @@ tail\n-c\n+d\n context\n");
    expect(two).toHaveLength(2);
    expect(two[1].heading).toBe("tail");
    expect(two[1].lines.at(-1)).toMatchObject({ kind: "context", text: "context" });
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(diffStat([])).toEqual({ added: 0, removed: 0 });
  });

  it("ignores the no-newline marker rather than treating it as a line", () => {
    const hunks = parseUnifiedDiff("@@ -1 +1 @@\n-old\n\\ No newline at end of file\n+new\n");
    expect(hunks[0].lines.map((l) => l.text)).toEqual(["old", "new"]);
  });
});
