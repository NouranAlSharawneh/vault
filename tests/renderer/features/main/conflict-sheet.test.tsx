import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ConflictSheet } from "@/features/main/components/conflict-sheet/conflict-sheet.component";
import type { ConflictPair, DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const doc = (over: Partial<DocMeta>): DocMeta => ({
  title: "Deploy checklist",
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: "2026-09-01T00:00:00Z",
  source: "manual",
  path: "atlas-api/deploy-checklist.md",
  excerpt: "excerpt",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
  ...over,
});
const pair: ConflictPair = {
  mine: doc({}),
  theirs: doc({ path: "atlas-api/deploy-checklist-from-github.md" }),
  mark: { of: "atlas-api/deploy-checklist.md", from: "github", at: "2026-09-12T09:15:00Z" },
};

describe("ConflictSheet", () => {
  const open = () => {
    const vault = mockMarascaApi({
      "conflicts:list": [pair],
      "doc:read": (path: string) => ({ meta: doc({ path }), body: path, raw: path }),
      "conflicts:resolve": undefined,
    });
    render(<ConflictSheet onClose={() => undefined} />);

    return vault;
  };

  it("names each 'Use this one' after the version it keeps", async () => {
    // Two identical visible labels read out as the same button twice.
    const vault = open();
    await userEvent.click(await screen.findByRole("button", { name: "Use the GitHub version" }));
    expect(vault.invoke).toHaveBeenCalledWith(
      "conflicts:resolve",
      "atlas-api/deploy-checklist-from-github.md",
      "theirs",
    );
    expect(screen.getByRole("button", { name: "Use this Mac’s version" })).toBeTruthy();
  });

  it("says what Keep both leaves behind, by the copy's real name", async () => {
    open();
    expect(
      await screen.findByText(
        "You’ll get both files — the GitHub one saved as deploy-checklist-from-github.md.",
      ),
    ).toBeTruthy();
  });
});
