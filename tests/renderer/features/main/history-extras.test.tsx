// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { foldCommits } from "@/features/main/components/history-drawer/helpers/fold-commits";
import { HistoryDrawer } from "@/features/main/components/history-drawer/history-drawer.component";
import { HISTORY_PAGE } from "@shared/constants";
import type { CommitInfo } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const commit = (n: number, patch: Partial<CommitInfo> = {}): CommitInfo => ({
  sha: String(n).padStart(40, "0"),
  shortSha: String(n).padStart(7, "0"),
  message: `commit ${n}`,
  date: "2026-09-01T00:00:00Z",
  relative: "",
  author: "nunu",
  path: "a.md",
  added: 1,
  removed: 0,
  metaOnly: false,
  ...patch,
});

describe("metadata-only commits", () => {
  const commits = [
    commit(1),
    commit(2, { metaOnly: true }),
    commit(3, { metaOnly: true }),
    commit(4),
    commit(5, { metaOnly: true }),
  ];

  it("fold two or more in a row into one line, and never a lone one", () => {
    const rows = foldCommits(commits, new Set(), commits[0].sha);
    expect(
      rows.map((r) => (r.kind === "fold" ? `fold:${r.commits.length}` : r.commit.message)),
    ).toEqual(["commit 1", "fold:2", "commit 4", "commit 5"]);
  });

  it("stay open when opened, or when the chosen commit is among them", () => {
    expect(foldCommits(commits, new Set([commits[1].sha]), null)).toHaveLength(5);
    expect(foldCommits(commits, new Set(), commits[2].sha)).toHaveLength(5);
  });
});

describe("the history drawer", () => {
  const open = () => render(<HistoryDrawer path="a.md" onClose={vi.fn()} onRestored={vi.fn()} />);

  it("loads older commits past the first page", async () => {
    const first = Array.from({ length: HISTORY_PAGE }, (_, i) => commit(i + 1));
    const { invoke } = mockMarascaApi({
      "doc:history": (_path: string, skip?: number) => (skip ? [commit(999)] : first),
      "doc:diff": "",
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Load older commits" }));
    expect(await screen.findByRole("button", { name: /commit 999/ })).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("doc:history", "a.md", HISTORY_PAGE);
    // A short page means there is nothing further back.
    expect(screen.queryByRole("button", { name: "Load older commits" })).toBeNull();
  });

  it("compares an older version with the file as it is now", async () => {
    const { invoke } = mockMarascaApi({
      "doc:history": [commit(1), commit(2)],
      "doc:diff": "",
      "doc:compare": "",
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: /commit 2/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Since then" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("doc:compare", "a.md", commit(2).sha));
    expect(await screen.findByText("Nothing has changed since this version.")).toBeTruthy();
  });

  it("says what each commit did to the text", async () => {
    mockMarascaApi({ "doc:history": [commit(1, { added: 12, removed: 3 })], "doc:diff": "" });
    open();
    expect(await screen.findByLabelText("12 added, 3 removed")).toBeTruthy();
  });
});
