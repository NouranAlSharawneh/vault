// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "@/features/main/components/document-list/document-list.component";
import { touchedAt } from "@/features/main/hooks/use-document-filter.hook";
import type { DocMeta } from "@shared/types";

const HOUR = 3_600_000;
const now = Date.now();
// Saved a month ago, edited an hour ago: Recent puts it at the top for the edit.
const edited: DocMeta = {
  title: "Edited lately",
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: new Date(now - 30 * 24 * HOUR).toISOString(),
  source: "claude",
  path: "atlas-api/edited.md",
  excerpt: "",
  words: 1,
  mtime: now - 3 * HOUR,
  size: 0,
  orphan: false,
};
const props = {
  title: "Recent",
  docs: [edited],
  selected: null,
  onSelect: vi.fn(),
  sort: "newest" as const,
  onSort: vi.fn(),
  activeTags: [] as string[],
  onRemoveTag: vi.fn(),
  onClearTags: vi.fn(),
};

describe("the time on a document row", () => {
  it("is the time Recent sorted by, so the order and the labels agree", () => {
    render(<DocumentList {...props} dateOf={touchedAt} />);
    expect(screen.getByText("3h")).toBeTruthy();
  });

  it("is when it was saved everywhere else", () => {
    render(<DocumentList {...props} title="All documents" />);
    expect(screen.queryByText("3h")).toBeNull();
  });
});
