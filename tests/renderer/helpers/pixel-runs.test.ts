import { describe, expect, it } from "vitest";
import { pixelRuns } from "@/helpers";

describe("pixelRuns", () => {
  it("merges neighbouring cells of the same kind and skips empty ones", () => {
    expect(pixelRuns(["LL.R", ".SSS"])).toEqual([
      { x: 0, y: 0, width: 2, cell: "L" },
      { x: 3, y: 0, width: 1, cell: "R" },
      { x: 1, y: 1, width: 3, cell: "S" },
    ]);
  });

  it("treats a custom empty character as empty", () => {
    expect(pixelRuns(["#.#"], ".")).toHaveLength(2);
    expect(pixelRuns(["#.#"], "#")).toEqual([{ x: 1, y: 0, width: 1, cell: "." }]);
  });
});
