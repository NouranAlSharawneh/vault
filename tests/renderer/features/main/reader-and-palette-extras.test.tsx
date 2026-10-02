// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "@/components/markdown";
import { fenceLanguage } from "@/components/markdown/code-block/fence-language";
import { sectionLink } from "@/components/markdown/linked-heading/section-link";
import { CommandPalette } from "@/features/main/components/command-palette/command-palette.component";
import { listFilterFor } from "@/features/main/components/command-palette/helpers/list-filter-for";
import { splitMatches } from "@/features/main/components/command-palette/helpers/split-matches";
import { outlineOf } from "@/features/main/components/document-reader/components/document-outline/outline-of";
import { FindBar } from "@/features/main/components/document-reader/components/find-bar/find-bar.component";
import { useFindInDoc } from "@/features/main/components/document-reader/hooks/use-find-in-doc.hook";
import { findRanges } from "@/helpers";
import { useApp } from "@/stores/app";
import { recordOpened } from "@/stores/library";
import { parseQuery } from "@shared/query";
import type { DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const writeText = vi.fn(async () => undefined);
beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(() => vi.useRealTimers());

describe("a code block in the reader", () => {
  it("names its language and copies its code", async () => {
    mockMarascaApi();
    render(<Markdown source={"```bash\nnpm run dev\n```"} docPath="a.md" />);
    expect(screen.getByText("bash")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("npm run dev"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("reads the language from the fence's class", () => {
    expect(fenceLanguage(<code className="hljs language-ts">x</code>)).toBe("ts");
    expect(fenceLanguage(<code>x</code>)).toBeNull();
  });
});

describe("a link to a section", () => {
  it("is copied from the heading, rooted at the vault so it works anywhere", async () => {
    mockMarascaApi();
    render(<Markdown source="## Why the edge" docPath="atlas api/rate.md" linkHeadings />);
    fireEvent.click(screen.getByRole("button", { name: "Copy a link to this section" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("[Why the edge](/atlas%20api/rate.md#why-the-edge)"),
    );
    expect(sectionLink("a.md", "user-content-intro", " Intro ")).toBe("[Intro](/a.md#intro)");
  });

  it("isn't offered in a preview that didn't ask for it", () => {
    render(<Markdown source="## Why the edge" docPath="a.md" />);
    expect(screen.queryByRole("button", { name: "Copy a link to this section" })).toBeNull();
  });
});

describe("the outline", () => {
  it("lists the rendered headings, in order, with their level", () => {
    const { container } = render(
      <Markdown source={"# One\n\n## Two\n\n### Three"} docPath="a.md" />,
    );
    expect(outlineOf(container).map((h) => [h.text, h.level])).toEqual([
      ["One", 1],
      ["Two", 2],
      ["Three", 3],
    ]);
  });
});

describe("find in a document", () => {
  it("finds every match, ignoring case, inside the text it is given", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Rate limits. More <b>rate</b> talk.</p>";
    const ranges = findRanges(root, "RATE");
    expect(ranges.map((r) => r.toString())).toEqual(["Rate", "rate"]);
    expect(findRanges(root, "  ")).toEqual([]);
  });

  it("opens on ⌘F and counts through the matches", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<div data-doc-scroller><p>one two one</p></div>";
    document.body.appendChild(root);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(root);

      return useFindInDoc(ref, "a.md:preview");
    });
    act(() => {
      fireEvent.keyDown(window, { key: "f", metaKey: true });
    });
    expect(result.current.open).toBe(true);
    act(() => result.current.setQuery("one"));
    await waitFor(() => expect(result.current.count).toBe(2));
    expect(result.current.current).toBe(1);
    act(() => result.current.next());
    expect(result.current.current).toBe(2);
    act(() => result.current.next());
    expect(result.current.current).toBe(1);
    root.remove();
  });

  it("says where you are among the matches, and steps with Enter and ⇧Enter", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <FindBar
        query="one"
        onQuery={vi.fn()}
        count={12}
        current={3}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("3 of 12");
    const input = screen.getByRole("textbox", { name: "Find in this document" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});

const doc = (path: string, title: string, over: Partial<DocMeta> = {}): DocMeta => ({
  title,
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: ["spec"],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path,
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
  ...over,
});

const setIndex = (docs: DocMeta[]) =>
  useApp.setState({
    config: null,
    sync: null,
    index: { docs, projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 0 },
  } as never);

describe("the palette", () => {
  it("picks out the words that found each result", () => {
    expect(splitMatches("Rate limiting at the edge", ["edge", "rate"])).toEqual([
      { text: "Rate", match: true },
      { text: " limiting at the ", match: false },
      { text: "edge", match: true },
    ]);
  });

  it("offers to show a filter-only query in the list, when the list can show exactly that", () => {
    expect(listFilterFor(parseQuery('project:"Atlas API" tags:spec'))).toEqual({
      collection: "all",
      project: "atlas-api",
      tags: ["spec"],
    });
    expect(listFilterFor(parseQuery("is:starred"))).toMatchObject({ collection: "starred" });
    // Words, dates, sources: the list can't narrow by them.
    expect(listFilterFor(parseQuery("rate tags:spec"))).toBeNull();
    expect(listFilterFor(parseQuery("source:claude"))).toBeNull();
  });

  it("puts what it found into the list when asked", () => {
    mockMarascaApi();
    setIndex([doc("a", "Alpha"), doc("b", "Beta", { tags: [] })]);
    const onShowInList = vi.fn();
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} onShowInList={onShowInList} />);
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "tags:spec" } });
    fireEvent.click(screen.getByText("Show 1 match in the list"));
    expect(onShowInList).toHaveBeenCalledWith({ collection: "all", project: null, tags: ["spec"] });
  });

  it("opens on what was read last, not what was captured last", () => {
    mockMarascaApi();
    setIndex([doc("a", "Newest capture"), doc("b", "Older, but just read")]);
    recordOpened("b");
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} />);
    const titles = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(titles[0]).toContain("Older, but just read");
  });
});
