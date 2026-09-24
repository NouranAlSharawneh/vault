import { describe, expect, it } from "vitest";
import { describeSave } from "@/helpers";
import type { SavedNotice } from "@shared/types";

const notice = (patch: Partial<SavedNotice> = {}): SavedNotice => ({
  title: "Spec",
  outcome: "updated",
  committed: true,
  keptOtherVersion: false,
  ...patch,
});

describe("describeSave", () => {
  it("says what kind of save it was", () => {
    expect(describeSave(notice({ outcome: "added" }))).toBe("Added “Spec” to the vault");
    expect(describeSave(notice())).toBe("Saved changes to “Spec”");
    expect(describeSave(notice({ outcome: "moved" }))).toBe("Saved “Spec” at its new location");
  });

  it("does not claim a commit that did not happen", () => {
    expect(describeSave(notice({ committed: false }))).toBe(
      "Saved changes to “Spec” — not committed yet",
    );
    expect(describeSave(notice({ outcome: "added", committed: false }))).toBe(
      "Saved “Spec” — not committed yet",
    );
  });

  it("does not claim a save that changed nothing", () => {
    expect(describeSave(notice({ outcome: "unchanged", committed: false }))).toBe(
      "No changes to “Spec” — nothing to save",
    );
  });

  it("says where the other version went when the file had changed elsewhere", () => {
    expect(describeSave(notice({ keptOtherVersion: true }))).toBe(
      "Saved “Spec” — it had changed elsewhere, so that version is in its history",
    );
  });
});
