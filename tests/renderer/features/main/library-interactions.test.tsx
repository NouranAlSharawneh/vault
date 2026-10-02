// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "@/features/main/components/document-list/document-list.component";
import { typeAhead } from "@/features/main/components/document-list/hooks/use-list-selection.hook";
import { DocumentRow } from "@/features/main/components/document-row/document-row.component";
import { useAdjacentDoc } from "@/features/main/hooks/use-adjacent-doc.hook";
import { landingAfter } from "@/features/main/hooks/use-bulk-actions.hook";
import { useSidebarState } from "@/features/main/hooks/use-sidebar-state.hook";
import { initialLibrary, recentOpened, recordOpened, useLibrary } from "@/stores/library";
import type { DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const doc = (path: string, title = path.toUpperCase(), tags: string[] = []): DocMeta => ({
  title,
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags,
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path,
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
});

const DOCS = [doc("a", "Alpha"), doc("b", "Beta"), doc("c", "Bravo"), doc("d", "Delta")];

/** The list with its selection held the way Main holds it. */
function List({ onBulk = vi.fn() }: { onBulk?: (a: string) => void }) {
  const [selected, setSelected] = useState<string | null>("a");
  const [picked, setPicked] = useState<string[]>([]);

  return (
    <DocumentList
      title="All documents"
      collection="all"
      project={null}
      scrollKey="k"
      docs={DOCS}
      selected={selected}
      onSelect={setSelected}
      picked={picked}
      onPick={setPicked}
      onBulk={onBulk}
      onOpen={vi.fn()}
      sort="newest"
      onSort={vi.fn()}
      activeTags={[]}
      onRemoveTag={vi.fn()}
      onClearTags={vi.fn()}
    />
  );
}

const option = (name: string) => screen.getByRole("option", { name: new RegExp(`^${name}`) });
const chosen = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .filter((o) => o.getAttribute("aria-selected") === "true")
    .map((o) => o.querySelector('[id$="-title"]')?.textContent);

describe("picking several documents", () => {
  it("adds and removes rows with ⌘-click, and acts on them together", () => {
    const onBulk = vi.fn();
    render(<List onBulk={onBulk} />);
    fireEvent.click(option("Beta"), { metaKey: true });
    fireEvent.click(option("Delta"), { metaKey: true });
    expect(chosen()).toEqual(["Alpha", "Beta", "Delta"]);
    expect(screen.getByRole("toolbar", { name: "3 documents picked" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Trash/ }));
    expect(onBulk).toHaveBeenCalledWith("trash");

    fireEvent.click(option("Beta"), { metaKey: true });
    expect(chosen()).toEqual(["Alpha", "Delta"]);
  });

  it("takes a run with ⇧-click and ⇧-arrows, and lets go with Escape or a plain click", () => {
    render(<List />);
    fireEvent.click(option("Bravo"), { shiftKey: true });
    expect(chosen()).toEqual(["Alpha", "Beta", "Bravo"]);

    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "Escape" });
    expect(chosen()).toEqual(["Alpha"]);

    fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
    expect(chosen()).toEqual(["Alpha", "Beta", "Bravo"]);
    expect(list.getAttribute("aria-multiselectable")).toBe("true");

    fireEvent.click(option("Delta"));
    expect(chosen()).toEqual(["Delta"]);
  });

  it("jumps to a title as it is typed, and steps through titles on the same letter", () => {
    render(<List />);
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "d" });
    expect(chosen()).toEqual(["Delta"]);
    expect(typeAhead(DOCS, "b", 0)).toBe(1);
    expect(typeAhead(DOCS, "bb", 1)).toBe(2);
    expect(typeAhead(DOCS, "br", 0)).toBe(2);
  });
});

describe("a row", () => {
  const row = (patch: Partial<Parameters<typeof DocumentRow>[0]> = {}) => {
    const props = {
      doc: doc("a", "Alpha", ["spec", "infra", "a", "b", "c", "d"]),
      selected: false,
      id: "row-a",
      when: "now",
      onActivate: vi.fn(),
      onOpen: vi.fn(),
      onMenu: vi.fn(),
      onTag: vi.fn(),
      ...patch,
    };
    render(<DocumentRow {...props} />);

    return props;
  };

  it("filters by a tag clicked on it, without selecting the row", () => {
    const p = row();
    fireEvent.click(screen.getByText("#infra"));
    expect(p.onTag).toHaveBeenCalledWith("infra");
    expect(p.onActivate).not.toHaveBeenCalled();
  });

  it("shows the rest of its tags from +N", () => {
    row();
    expect(screen.queryByText("#d")).toBeNull();
    fireEvent.click(screen.getByText("+2"));
    expect(screen.getByText("#d")).toBeTruthy();
  });

  it("opens its menu on a right-click", () => {
    const p = row();
    fireEvent.contextMenu(screen.getByRole("option"));
    expect(p.onMenu).toHaveBeenCalledWith("a");
  });
});

describe("after a bulk trash", () => {
  it("lands on the first row after the ones that went, or before them at the end", () => {
    expect(landingAfter(DOCS, new Set(["b", "c"]))).toBe("d");
    expect(landingAfter(DOCS, new Set(["c", "d"]))).toBe("b");
    expect(landingAfter(DOCS, new Set(["a", "b", "c", "d"]))).toBeNull();
  });
});

describe("⌥↑ and ⌥↓", () => {
  it("read the next or previous document from anywhere in the window", () => {
    const select = vi.fn();
    renderHook(() => useAdjacentDoc(DOCS, "b", select));
    fireEvent.keyDown(window, { key: "ArrowDown", altKey: true });
    expect(select).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(window, { key: "ArrowUp", altKey: true });
    expect(select).toHaveBeenLastCalledWith("a");
  });
});

describe("the sidebar in a narrow window", () => {
  const width = (px: number) => {
    Object.defineProperty(window, "innerWidth", { value: px, configurable: true });
    window.dispatchEvent(new Event("resize"));
  };

  it("shows the rail without forgetting the full sidebar was chosen", () => {
    mockMarascaApi();
    width(1400);
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.state).toBe("full");
    act(() => width(900));
    expect(result.current.state).toBe("rail");
    expect(localStorage.getItem("sidebar-state")).toBe("full");
    // Asked for while narrow, the full sidebar stays out until the window widens.
    act(() => result.current.cycle());
    expect(result.current.state).toBe("full");
    act(() => width(1400));
    expect(result.current.state).toBe("full");
  });
});

describe("across launches", () => {
  it("remembers the open document and the list's scroll", () => {
    act(() => {
      useLibrary.getState().setSelected("atlas-api/spec.md");
    });
    vi.useFakeTimers();
    useLibrary.getState().setScroll({ key: "all", top: 420 });
    vi.runAllTimers();
    vi.useRealTimers();
    expect(initialLibrary()).toMatchObject({
      selected: "atlas-api/spec.md",
      scroll: { key: "all", top: 420 },
    });
    useLibrary.setState(initialLibrary());
  });

  it("keeps the documents last opened, newest first, once each", () => {
    recordOpened("a");
    recordOpened("b");
    recordOpened("a");
    expect(recentOpened()).toEqual(["a", "b"]);
  });
});
