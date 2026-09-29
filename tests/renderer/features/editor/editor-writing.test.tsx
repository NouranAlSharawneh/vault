// @vitest-environment jsdom
import { insertBracket } from "@codemirror/autocomplete";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SplitPane } from "@/components/ui";
import {
  insertLink,
  toggleWrap,
} from "@/features/editor/components/markdown-editor/extensions/format";
import { imageMarkdown } from "@/features/editor/components/markdown-editor/extensions/images";
import { writing } from "@/features/editor/components/markdown-editor/extensions/writing";
import { minimalChange } from "@/features/editor/components/markdown-editor/hooks/use-codemirror.hook";
import { MarkdownPaneHeader } from "@/features/editor/components/markdown-pane-header/markdown-pane-header.component";
import { MetadataBar } from "@/features/editor/components/metadata-bar/metadata-bar.component";
import { OutlinePopover } from "@/features/editor/components/outline-popover/outline-popover.component";
import { ShortcutsPopover } from "@/features/editor/components/shortcuts-popover/shortcuts-popover.component";
import { TitleField } from "@/features/editor/components/title-field/title-field.component";
import { useEditorShortcuts } from "@/features/editor/hooks/use-editor-shortcuts.hook";
import { useFocusMode } from "@/features/editor/hooks/use-focus-mode.hook";
import { headingsOf, renameHint } from "@/helpers";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

/** Run a command on `doc` with `sel` selected ([from, to]); the text and selection after. */
function run(command: StateCommand, doc: string, [from, to]: [number, number]) {
  let state = EditorState.create({ doc, selection: EditorSelection.range(from, to) });
  command({ state, dispatch: (tr) => (state = tr.state) });
  const { from: a, to: b } = state.selection.main;

  return { text: state.doc.toString(), selected: state.sliceDoc(a, b), at: a };
}

describe("formatting the selection", () => {
  it("wraps a selection in bold, and takes it off again from inside or around it", () => {
    expect(run(toggleWrap("**"), "make it bold", [8, 12])).toMatchObject({
      text: "make it **bold**",
      selected: "bold",
    });
    expect(run(toggleWrap("**"), "make it **bold**", [10, 14]).text).toBe("make it bold");
    expect(run(toggleWrap("**"), "make it **bold**", [8, 16])).toMatchObject({
      text: "make it bold",
      selected: "bold",
    });
  });

  it("puts markers either side of the cursor with nothing selected, ready to type between", () => {
    expect(run(toggleWrap("`"), "run ", [4, 4])).toMatchObject({ text: "run ``", at: 5 });
  });

  it("uses _ for italic, so a bold word is never taken for italic", () => {
    expect(run(toggleWrap("_"), "**bold**", [0, 8]).text).toBe("_**bold**_");
  });

  it("makes a link from words, or from an address", () => {
    expect(run(insertLink, "see docs", [4, 8])).toMatchObject({
      text: "see [docs](url)",
      selected: "url",
    });
    expect(run(insertLink, "https://x.dev", [0, 13])).toMatchObject({
      text: "[](https://x.dev)",
      at: 1,
    });
  });

  it("closes a bracket as it is typed", () => {
    const state = EditorState.create({
      doc: "call",
      selection: { anchor: 4 },
      extensions: writing,
    });
    const tr = insertBracket(state, "(");
    expect(tr?.state.doc.toString()).toBe("call()");
  });
});

describe("keeping the text in step", () => {
  it("changes only what differs, so the cursor outside it stays put", () => {
    // A save that rewrote one link used to replace the whole text and throw the cursor.
    const before = "intro\n\n![shot](paste-0a1b2c3d4e5f.png)\n\nmore text";
    const after = "intro\n\n![shot](assets/paste-0a1b2c3d4e5f.png)\n\nmore text";
    const c = minimalChange(before, after);
    expect(before.slice(0, c.from) + c.insert + before.slice(c.to)).toBe(after);
    expect(c.insert).toBe("assets/");
  });
});

describe("pasted images", () => {
  it("links each kept image by its file name, and skips one that couldn't be kept", () => {
    const files = [new File([""], "diagram.png"), new File([""], "broken.png")];
    expect(imageMarkdown(files, ["paste-0a1b2c3d4e5f.png", null])).toBe(
      "![diagram](paste-0a1b2c3d4e5f.png)",
    );
  });
});

describe("the outline", () => {
  it("lists headings, but not a # line inside a code block", () => {
    const body = "# Title\n\n```sh\n# install deps\n```\n\n## Setup ##\n\ntext\n### Deep";
    expect(headingsOf(body)).toEqual([
      { level: 1, text: "Title", line: 1 },
      { level: 2, text: "Setup", line: 7 },
      { level: 3, text: "Deep", line: 10 },
    ]);
  });

  it("filters as you type and jumps to the chosen heading", async () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    render(
      <OutlinePopover
        headings={[
          { level: 1, text: "Title", line: 1 },
          { level: 2, text: "Setup", line: 7 },
        ]}
        onJump={onJump}
        onClose={onClose}
      />,
    );
    const filter = screen.getByRole("combobox", { name: "Filter headings" });
    // Opens ready to type in, not on its close button.
    expect(document.activeElement).toBe(filter);
    await userEvent.type(filter, "set{Enter}");
    expect(onJump).toHaveBeenCalledWith(7);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("the title", () => {
  it("says a save will rename a saved document, or move it", () => {
    expect(renameHint("atlas-api/old.md", "atlas-api/new.md")).toEqual({
      kind: "rename",
      path: "new.md",
    });
    expect(renameHint("atlas-api/a.md", "research/a.md")).toEqual({
      kind: "move",
      path: "research/a.md",
    });
    expect(renameHint(null, "atlas-api/a.md")).toBeNull();
    expect(renameHint("atlas-api/a.md", "atlas-api/a.md")).toBeNull();
  });

  it("is a labelled field at the top, with the rename said under it", () => {
    render(
      <TitleField
        value="New name"
        inferredTitle="Old"
        onChange={() => undefined}
        renameTo={{ kind: "rename", path: "new-name.md" }}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Title" });
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/Will rename to/).textContent).toContain("new-name.md");
  });
});

describe("the metadata bar", () => {
  it("stars the document from the editor", async () => {
    const onChange = vi.fn();
    render(
      <MetadataBar
        meta={{ title: "", project: "", tags: [], source: "manual", starred: false }}
        onChange={onChange}
        projects={[]}
        tags={[]}
        lastProject={null}
      />,
    );
    const star = screen.getByRole("button", { name: "Star", pressed: false });
    await userEvent.click(star);
    expect(onChange).toHaveBeenCalledWith({ starred: true });
  });
});

describe("the pane header", () => {
  it("says the length and reading time, or what is selected", () => {
    const props = { focusMode: false, onFocusMode: vi.fn(), onShortcuts: vi.fn() };
    const { rerender } = render(<MarkdownPaneHeader words={440} selectedWords={0} {...props} />);
    expect(screen.getByText("440 words · 2 min")).toBeTruthy();
    rerender(<MarkdownPaneHeader words={440} selectedWords={12} {...props} />);
    expect(screen.getByText("12 of 440 words selected")).toBeTruthy();
  });

  it("lists every key the editor answers to", () => {
    render(<ShortcutsPopover onClose={() => undefined} />);
    for (const does of ["Bold", "Italic", "Inline code", "Link", "Jump to a heading"])
      expect(screen.getByText(does)).toBeTruthy();
    expect(screen.getByText(/Focus mode/)).toBeTruthy();
  });
});

describe("focus mode", () => {
  beforeEach(() => localStorage.clear());

  it("folds the preview away with the text still there, and is remembered", () => {
    const { result } = renderHook(() => useFocusMode());
    expect(result.current.focusMode).toBe(false);
    act(() => result.current.toggleFocusMode());
    expect(result.current.focusMode).toBe(true);
    expect(localStorage.getItem("editor-focus-mode")).toBe("1");
    // The next editor window opens the way this one was left.
    expect(renderHook(() => useFocusMode()).result.current.focusMode).toBe(true);

    render(<SplitPane left={<p>text</p>} right={<p>preview</p>} collapsed />);
    expect(screen.getByText("text")).toBeTruthy();
    expect(screen.getByText("preview").parentElement?.hidden).toBe(true);
  });
});

describe("the editor's keys", () => {
  it("answer ⌥⌘P and ⇧⌘O from anywhere, by key position", () => {
    mockMarascaApi();
    const onFocusMode = vi.fn();
    const onOutline = vi.fn();
    renderHook(() =>
      useEditorShortcuts({
        onSave: vi.fn(),
        onSaveClose: vi.fn(),
        onEscape: vi.fn(),
        onFocusMode,
        onOutline,
      }),
    );
    // With ⌥ held macOS reports P as "π": the key's position is what counts.
    fireEvent.keyDown(window, { key: "π", code: "KeyP", metaKey: true, altKey: true });
    fireEvent.keyDown(window, { key: "O", code: "KeyO", metaKey: true, shiftKey: true });
    expect(onFocusMode).toHaveBeenCalledTimes(1);
    expect(onOutline).toHaveBeenCalledTimes(1);
  });

  it("leave Escape to an open dialog instead of closing the window under it", () => {
    mockMarascaApi();
    const onEscape = vi.fn();
    renderHook(() => useEditorShortcuts({ onSave: vi.fn(), onSaveClose: vi.fn(), onEscape }));
    render(<ShortcutsPopover onClose={() => undefined} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
  });
});
