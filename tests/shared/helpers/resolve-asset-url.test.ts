import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "@shared/helpers";

describe("resolveAssetUrl", () => {
  it("resolves relative paths against the document's folder", () => {
    expect(resolveAssetUrl("docs/hero.png", "atlas-api/spec.md")).toBe(
      "vault://asset/atlas-api/docs/hero.png",
    );
    expect(resolveAssetUrl("./a b.png", "notes.md")).toBe("vault://asset/a%20b.png");
    expect(resolveAssetUrl("../shared/x.gif", "p/q/doc.md")).toBe("vault://asset/p/shared/x.gif");
  });

  it("treats a leading slash as the repo root and never escapes it", () => {
    expect(resolveAssetUrl("/assets/x.png", "p/doc.md")).toBe("vault://asset/assets/x.png");
    expect(resolveAssetUrl("../../../etc/passwd", "p/doc.md")).toBe("vault://asset/etc/passwd");
  });

  it("leaves absolute URLs and anchors alone", () => {
    expect(resolveAssetUrl("https://x.test/a.png", "doc.md")).toBe("https://x.test/a.png");
    expect(resolveAssetUrl("data:image/png;base64,AA==", "doc.md")).toMatch(/^data:/);
    expect(resolveAssetUrl("#top", "doc.md")).toBe("#top");
  });
});
