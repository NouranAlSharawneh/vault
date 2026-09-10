import { describe, expect, it } from "vitest";
import { rootsFromHits } from "@main/services/assets";

/**
 * `mdfind` can only search by filename, so the folder in front of the ref is the only thing
 * separating the file the doc meant from every other copy on the disk.
 */
describe("rootsFromHits", () => {
  const hits = [
    "/Users/n/Coding/concorde/docs/hero-flyin.gif",
    "/Users/n/Downloads/hero-flyin.gif",
    "/Users/n/Desktop/shots/hero-flyin.gif",
    "/Volumes/backup/concorde-old/docs/hero-flyin.gif",
    "",
  ].join("\n");

  it("keeps only hits whose path ends with the whole ref, and strips it off", () => {
    expect(rootsFromHits(hits, "docs/hero-flyin.gif")).toEqual([
      "/Users/n/Coding/concorde",
      "/Volumes/backup/concorde-old",
    ]);
  });

  it("does not treat a bare filename match as the folder it was looking for", () => {
    expect(rootsFromHits("/Users/n/Downloads/hero-flyin.gif", "docs/hero-flyin.gif")).toEqual([]);
  });

  it("handles a ref that is just a filename", () => {
    expect(rootsFromHits("/Users/n/Downloads/hero-flyin.gif", "hero-flyin.gif")).toEqual([
      "/Users/n/Downloads",
    ]);
  });
});
