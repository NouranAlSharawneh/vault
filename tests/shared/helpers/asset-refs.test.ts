import { describe, expect, it } from "vitest";
import { findAssetRefs, rewriteAssetRefs } from "@shared/helpers";

const MD = `# Concorde

![hero](docs/hero-flyin.gif "The landing page")
![same again](docs/hero-flyin.gif)
![remote](https://x.test/a.png) ![data](data:image/png;base64,AA==)
<img src="./shots/one.png" alt="one"> <video src="clips/loop.mp4"></video>
[download the clip](clips/loop.mp4) [a doc](../notes.md) [anchor](#top)
`;

describe("findAssetRefs", () => {
  it("finds relative images and media once each, ignoring URLs, data URIs and non-media links", () => {
    expect(findAssetRefs(MD)).toEqual(["docs/hero-flyin.gif", "./shots/one.png", "clips/loop.mp4"]);
  });

  it("strips query and hash from the path it reports, and unwraps <paths with spaces>", () => {
    expect(findAssetRefs("![x](img/a.png?raw=1#frag)")).toEqual(["img/a.png"]);
    expect(findAssetRefs("![x](<docs/Hero Fly-in.gif>)")).toEqual(["docs/Hero Fly-in.gif"]);
  });
});

describe("rewriteAssetRefs", () => {
  it("rewrites every syntax and leaves everything else alone", () => {
    const out = rewriteAssetRefs(MD, {
      "docs/hero-flyin.gif": "assets/hero-flyin.gif",
      "./shots/one.png": "assets/one.png",
      "clips/loop.mp4": "assets/loop.mp4",
    });
    expect(out).toContain('![hero](assets/hero-flyin.gif "The landing page")');
    expect(out).toContain("![same again](assets/hero-flyin.gif)");
    expect(out).toContain('<img src="assets/one.png" alt="one">');
    expect(out).toContain('<video src="assets/loop.mp4">');
    expect(out).toContain("[download the clip](assets/loop.mp4)");
    expect(out).toContain("[a doc](../notes.md)");
    expect(out).toContain("![remote](https://x.test/a.png)");
    expect(rewriteAssetRefs("![x](img/a.png?raw=1)", { "img/a.png": "assets/a.png" })).toBe(
      "![x](assets/a.png?raw=1)",
    );
    expect(
      rewriteAssetRefs("![x](<docs/Hero Fly-in.gif>)", {
        "docs/Hero Fly-in.gif": "assets/hero.gif",
      }),
    ).toBe("![x](assets/hero.gif)");
  });
});
