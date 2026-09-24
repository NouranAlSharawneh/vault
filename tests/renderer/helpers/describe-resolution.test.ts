import { describe, expect, it } from "vitest";
import { describeResolution } from "@/helpers";

describe("describeResolution", () => {
  it("names the version that won and where the other went", () => {
    expect(describeResolution("mine", "Spec", "spec-github.md")).toBe(
      "Kept this Mac’s version of “Spec” — the GitHub one is in the trash",
    );
    expect(describeResolution("theirs", "Spec", "spec-github.md")).toBe(
      "Kept the GitHub version of “Spec” — this Mac’s is in the trash",
    );
    expect(describeResolution("both", "Spec", "spec-github.md")).toBe(
      "Kept both versions of “Spec” — the GitHub one is saved as spec-github.md",
    );
  });
});
