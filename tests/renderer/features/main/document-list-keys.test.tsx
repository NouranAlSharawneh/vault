import { fireEvent, render, screen, within } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "@/features/main/components/document-list/document-list.component";
import type { DocMeta } from "@shared/types";

const doc = (path: string): DocMeta => ({
  title: path.toUpperCase(),
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path,
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
});

const props = (over: Partial<Parameters<typeof DocumentList>[0]> = {}) => ({
  title: "All documents",
  collection: "all" as const,
  project: null,
  scrollKey: "k",
  docs: ["a", "b", "c"].map(doc),
  selected: "a",
  onSelect: vi.fn(),
  onOpen: vi.fn(),
  sort: "newest" as const,
  onSort: vi.fn(),
  activeTags: [] as string[],
  onRemoveTag: vi.fn(),
  onClearTags: vi.fn(),
  ...over,
});

describe("the document list from the keyboard", () => {
  it("is one listbox that says which document is selected", () => {
    // Every row used to be its own Tab stop, with no arrow keys at all.
    render(<DocumentList {...props()} />);
    const list = screen.getByRole("listbox", { name: "All documents" });
    expect(list.tabIndex).toBe(0);
    // Within the list: the sort menu's own options are options too.
    expect(within(list).getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    expect(list.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "A" }).id,
    );
  });

  it("moves with the arrows, jumps with Home and End, and opens with Enter", () => {
    const p = props();
    render(<DocumentList {...p} />);
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(p.onSelect).toHaveBeenLastCalledWith("b");
    fireEvent.keyDown(list, { key: "End" });
    expect(p.onSelect).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(list, { key: "Enter" });
    expect(p.onOpen).toHaveBeenCalledWith("a");
  });

  it("opens a document on double-click", () => {
    const p = props();
    render(<DocumentList {...p} />);
    fireEvent.doubleClick(screen.getByRole("option", { name: "B" }));
    expect(p.onOpen).toHaveBeenCalledWith("b");
  });
});
