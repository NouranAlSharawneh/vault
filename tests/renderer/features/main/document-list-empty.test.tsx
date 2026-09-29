import { fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "@/features/main/components/document-list/document-list.component";

const props = {
  collection: "all" as const,
  project: null,
  scrollKey: "k",
  onOpen: vi.fn(),
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
    render(<DocumentList {...props} title="Starred" collection="starred" />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    expect(screen.getByText(/Star a document from the reader/)).toBeTruthy();
    expect(screen.queryByText(/match this filter/)).toBeNull();
  });

  it("tells a new vault what to do instead, naming the shortcut", () => {
    render(<DocumentList {...props} title="All documents" hotkey="Control+Alt+V" />);
    expect(screen.getByText(/press (⌃⌥V|Ctrl\+Alt\+V) to capture it/)).toBeTruthy();
  });

  it("gives a project called Recent a project's hint, not Recent's", () => {
    // The hint was picked by the title, so the name of a project could borrow another's.
    render(<DocumentList {...props} title="Recent" project="recent" />);
    expect(screen.getByText("Nothing in Recent yet.")).toBeTruthy();
  });

  it("names the filter when there is one, and offers to clear it", () => {
    const onClearTags = vi.fn();
    render(
      <DocumentList
        {...props}
        title="Atlas API"
        project="atlas-api"
        activeTags={["spec", "infra"]}
        onClearTags={onClearTags}
      />,
    );
    expect(screen.getByText("Nothing matches")).toBeTruthy();
    expect(screen.getByText("No documents in Atlas API tagged #spec #infra.")).toBeTruthy();
    fireEvent.click(screen.getByText("Clear 2 tags"));
    expect(onClearTags).toHaveBeenCalled();
  });

  it("says the trash is empty in so many words", () => {
    render(<DocumentList {...props} title="Trash" collection="trash" />);
    expect(screen.getByText("Trash is empty")).toBeTruthy();
    expect(screen.getByText(/Deleted documents wait here/)).toBeTruthy();
  });
});
