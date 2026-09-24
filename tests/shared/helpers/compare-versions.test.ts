import { describe, expect, it } from "vitest";
import { compareVersions } from "@shared/helpers";

describe("compareVersions", () => {
  it.each([
    ["0.0.2", "0.0.1", 1],
    ["0.0.1", "0.0.2", -1],
    ["0.1.0", "0.0.9", 1],
    ["1.0.0", "0.99.99", 1],
    ["0.0.10", "0.0.9", 1], // numeric, not string, order
    ["v0.0.1", "0.0.1", 0],
    ["0.0.2-beta.1", "0.0.2", 0],
  ])("%s vs %s", (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
  });

  it("treats anything unreadable as equal, so a junk tag never reads as an update", () => {
    expect(compareVersions("nightly", "0.0.1")).toBe(0);
  });
});
