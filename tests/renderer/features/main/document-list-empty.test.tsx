import { fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "@/features/main/components/document-list/document-list.component";

const props = {
  docs: [],
  selected: null,
  onSelect: vi.fn(),
  sort: "newest" as const,
  onSort: vi.fn(),
  activeTags: [] as string[],
  onRemoveTag: vi.fn(),
  onClearTags: vi.fn(),
  sortable: true,
};

describe("an empty document list", () => {
  it("does not blame a filter that is not there", () => {
    // Starred with nothing starred used to read "No documents match this filter."
    render(<DocumentList {...props} title="Starred" />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    expect(screen.getByText(/Star a document from the reader/)).toBeTruthy();
    expect(screen.queryByText(/match this filter/)).toBeNull();
  });

  it("tells a new vault what to do instead", () => {
    render(<DocumentList {...props} title="All documents" />);
    expect(screen.getByText(/Capture something with the hotkey/)).toBeTruthy();
  });

  it("names the filter when there is one, and offers to clear it", () => {
    const onClearTags = vi.fn();
    render(
      <DocumentList
        {...props}
        title="Atlas API"
        activeTags={["spec", "infra"]}
        onClearTags={onClearTags}
      />,
    );
    expect(screen.getByText("Nothing matches")).toBeTruthy();
    expect(screen.getByText("No documents in Atlas API tagged #spec #infra.")).toBeTruthy();
    fireEvent.click(screen.getByText("Clear 2 tags"));
    expect(onClearTags).toHaveBeenCalled();
  });

  it("still lets a caller say something of its own", () => {
    render(<DocumentList {...props} title="Trash" emptyHint="Deleted documents wait here." />);
    expect(screen.getByText("Deleted documents wait here.")).toBeTruthy();
  });
});
