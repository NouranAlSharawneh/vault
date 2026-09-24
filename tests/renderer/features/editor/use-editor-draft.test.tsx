import { act, renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useEditorDraft } from "@/features/editor/hooks/use-editor-draft.hook";
import { useApp } from "@/stores/app";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const config = {
  root: "/tmp/v",
  remote: "nunu/vault",
  branch: "main",
  lastProject: "Atlas API",
  lastSource: "claude" as const,
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

const KEY = "untitled:one";

describe("useEditorDraft", () => {
  it("infers the title from the first heading and previews the path", async () => {
    mockMarascaApi({ "doc:pathPreview": () => "atlas-api/rate-limiting-at-the-edge.md" });
    useApp.setState({ config });
    const { result } = renderHook(() => useEditorDraft(KEY));
    expect(result.current.dirty).toBe(false);
    expect(result.current.canSave).toBe(false);
    act(() => result.current.setBody("# Rate limiting at the edge\n\nbody"));
    expect(result.current.inferredTitle).toBe("Rate limiting at the edge");
    expect(result.current.effectiveTitle).toBe("Rate limiting at the edge");
    expect(result.current.dirty).toBe(true);
    expect(result.current.canSave).toBe(true);
    await waitFor(() =>
      expect(result.current.pathPreview).toBe("atlas-api/rate-limiting-at-the-edge.md"),
    );
  });

  it("an explicit title wins over the heading", () => {
    mockMarascaApi({ "doc:pathPreview": () => "" });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("# From heading"));
    act(() => result.current.setMeta({ title: "Typed title" }));
    expect(result.current.effectiveTitle).toBe("Typed title");
  });

  it("save sends frontmatter + body, then the draft is clean and bound to the saved path", async () => {
    const meta = {
      title: "Doc",
      project: "Atlas API",
      tags: ["spec"],
      created: "2026-09-10T00:00:00Z",
      source: "claude" as const,
      path: "atlas-api/doc.md",
      projectSlug: "atlas-api",
      excerpt: "",
      words: 1,
      mtime: 0,
      size: 0,
      orphan: false,
    };
    const { invoke } = mockMarascaApi({
      "doc:pathPreview": () => "atlas-api/doc.md",
      "doc:save": () => ({ path: "atlas-api/doc.md", meta, committed: true }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("# Doc\n\nhello"));
    act(() => result.current.setMeta({ project: "Atlas API", tags: ["spec"] }));
    await act(async () => {
      await result.current.save("commit");
    });
    const call = invoke.mock.calls.find((c) => c[0] === "doc:save")!;
    expect(call[1]).toMatchObject({
      body: "# Doc\n\nhello",
      commit: true,
      frontmatter: { title: "Doc", project: "Atlas API", tags: ["spec"], source: "claude" },
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.existingPath).toBe("atlas-api/doc.md");
    expect(result.current.created).toBe("2026-09-10T00:00:00Z");
    expect(result.current.lastSaved?.committed).toBe(true);
  });

  it("surfaces a save failure and stays dirty", async () => {
    mockMarascaApi({ "doc:pathPreview": () => "", "doc:save": new Error("git is not installed") });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("text"));
    await act(async () => {
      await result.current.save("local");
    });
    expect(result.current.error).toBe("git is not installed");
    expect(result.current.dirty).toBe(true);
  });

  it("saves once when ⌘↵ reaches it twice for one press", async () => {
    // CodeMirror's Mod-Enter and the menu's accelerator can both fire. For a new document
    // the second save used to write a second file.
    let finish: (v: unknown) => void = () => undefined;
    const { invoke } = mockMarascaApi({
      "doc:pathPreview": () => "",
      "doc:save": () => new Promise((r) => (finish = r)),
    });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("# Twice"));
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.save("commit");
      second = result.current.save("commit");
    });
    expect(await second).toBeNull();
    finish({
      path: "inbox/twice.md",
      meta: { path: "inbox/twice.md", title: "Twice" },
      committed: true,
    });
    await act(() => first);
    expect(invoke.mock.calls.filter((c) => c[0] === "doc:save")).toHaveLength(1);
    expect(result.current.existingPath).toBe("inbox/twice.md");
  });

  it("says why an empty document can't be saved, instead of doing nothing", async () => {
    const { invoke } = mockMarascaApi({ "doc:pathPreview": () => "" });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("   "));
    await act(async () => {
      expect(await result.current.save("commit")).toBeNull();
    });
    expect(result.current.error).toMatch(/nothing to save/);
    expect(invoke).not.toHaveBeenCalledWith("doc:save", expect.anything());
  });

  it("parks each untitled window's text under its own key", async () => {
    // Every new window used to park under "new": the second opened with the first one's
    // text, and saving either cleared the other's.
    vi.useFakeTimers();
    const { invoke } = mockMarascaApi({ "doc:pathPreview": () => "" });
    const a = renderHook(() => useEditorDraft("untitled:a"));
    const b = renderHook(() => useEditorDraft("untitled:b"));
    act(() => a.result.current.setBody("first window"));
    act(() => b.result.current.setBody("second window"));
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    vi.useRealTimers();
    expect(invoke).toHaveBeenCalledWith(
      "draft:save",
      "untitled:a",
      expect.objectContaining({ body: "first window" }),
    );
    expect(invoke).toHaveBeenCalledWith(
      "draft:save",
      "untitled:b",
      expect.objectContaining({ body: "second window" }),
    );
    act(() => b.result.current.discardDraft());
    expect(invoke).toHaveBeenCalledWith("draft:clear", "untitled:b");
    expect(invoke).not.toHaveBeenCalledWith("draft:clear", "untitled:a");
  });

  it("loadDraft pre-fills from the capture payload and the last-used project", () => {
    mockMarascaApi({ "doc:pathPreview": () => "" });
    useApp.setState({ config });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.loadDraft({ body: "# Pasted", frontmatter: { source: "chatgpt" } }));
    expect(result.current.meta.project).toBe("Atlas API");
    expect(result.current.meta.source).toBe("chatgpt");
    expect(result.current.dirty).toBe(true);
  });
});

describe("an unsaved draft", () => {
  it("is parked outside the vault while you type, and cleared once it is saved", async () => {
    vi.useFakeTimers();
    const { invoke } = mockMarascaApi({
      "doc:save": {
        path: "p/note.md",
        meta: { path: "p/note.md", created: "x", mtime: 1, title: "Note" },
        committed: true,
      },
    });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("half a thought"));
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(invoke).toHaveBeenCalledWith(
      "draft:save",
      KEY,
      expect.objectContaining({ body: "half a thought" }),
    );
    vi.useRealTimers();
    await act(() => result.current.save("commit"));
    expect(invoke).toHaveBeenCalledWith("draft:clear", KEY);
    expect(invoke).toHaveBeenCalledWith("draft:clear", "p/note.md");
  });

  it("comes back when the document is opened again", async () => {
    mockMarascaApi({ "draft:load": { body: "what I was writing", meta: {}, at: "2026-01-01" } });
    const { result } = renderHook(() => useEditorDraft(KEY));
    await act(() => result.current.recoverDraft(KEY));
    expect(result.current.body).toBe("what I was writing");
    expect(result.current.dirty).toBe(true);
  });

  it("never overwrites text already typed in this window", async () => {
    mockMarascaApi({ "draft:load": { body: "the old one", meta: {}, at: "2026-01-01" } });
    const { result } = renderHook(() => useEditorDraft(KEY));
    act(() => result.current.setBody("what I am writing now"));
    await act(() => result.current.recoverDraft(KEY));
    expect(result.current.body).toBe("what I am writing now");
  });
});
