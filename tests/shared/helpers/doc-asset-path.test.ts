import { describe, expect, it } from "vitest";
import { docAssetPath } from "@shared/helpers";

/** The repo-relative half of `resolveAssetUrl`, also used to decide which files a purge takes. */
describe("docAssetPath", () => {
  it("resolves against the document's folder", () => {
    expect(docAssetPath("assets/hero.gif", "concorde/flight.md")).toBe("concorde/assets/hero.gif");
    expect(docAssetPath("./a.png", "notes.md")).toBe("a.png");
    expect(docAssetPath("../shared/x.gif", "p/q/doc.md")).toBe("p/shared/x.gif");
    expect(docAssetPath("/assets/x.png", "p/doc.md")).toBe("assets/x.png");
  });

  it("clamps `..` at the repo root instead of escaping it", () => {
    expect(docAssetPath("../../../etc/passwd", "p/doc.md")).toBe("etc/passwd");
  });

  it("is null for anything that isn't a path in this repo", () => {
    expect(docAssetPath("https://x.test/a.png", "doc.md")).toBeNull();
    expect(docAssetPath("//x.test/a.png", "doc.md")).toBeNull();
    expect(docAssetPath("data:image/png;base64,AA==", "doc.md")).toBeNull();
    expect(docAssetPath("#top", "doc.md")).toBeNull();
    expect(docAssetPath("", "doc.md")).toBeNull();
  });
});
