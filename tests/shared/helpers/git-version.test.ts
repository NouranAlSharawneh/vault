import { describe, expect, it } from "vitest";
import { isVersionAtLeast, parseGitVersion } from "@shared/helpers";

describe("parseGitVersion", () => {
  it("reads Apple's and upstream's output", () => {
    expect(parseGitVersion("git version 2.39.5 (Apple Git-154)\n")).toBe("2.39.5");
    expect(parseGitVersion("git version 2.51.0")).toBe("2.51.0");
    expect(parseGitVersion("git version 2.28")).toBe("2.28");
  });

  it("is null for anything that isn't git", () => {
    expect(parseGitVersion("xcrun: error: invalid active developer path")).toBeNull();
  });
});

describe("isVersionAtLeast", () => {
  it("compares part by part, not as text", () => {
    expect(isVersionAtLeast("2.39.5", "2.28.0")).toBe(true);
    expect(isVersionAtLeast("2.28", "2.28.0")).toBe(true);
    expect(isVersionAtLeast("2.9.0", "2.28.0")).toBe(false);
    expect(isVersionAtLeast("2.24.3", "2.28.0")).toBe(false);
    expect(isVersionAtLeast("3.0", "2.28.0")).toBe(true);
  });
});
