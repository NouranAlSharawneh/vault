import { describe, expect, it } from "vitest";
import { plural, pluralWord } from "@/helpers";

describe("pluralWord", () => {
  it("is singular for exactly one and plural otherwise, zero included", () => {
    expect(pluralWord(1, "document")).toBe("document");
    expect(pluralWord(0, "document")).toBe("documents");
    expect(pluralWord(2, "document")).toBe("documents");
  });

  it("takes an irregular plural", () => {
    expect(pluralWord(3, "library", "libraries")).toBe("libraries");
  });

  it("agrees with plural, which only adds the count", () => {
    expect(plural(1, "tag")).toBe("1 tag");
    expect(plural(1200, "tag")).toBe(`${(1200).toLocaleString()} tags`);
  });
});
