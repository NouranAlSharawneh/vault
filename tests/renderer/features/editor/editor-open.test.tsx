import { renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useEditorDraft } from "@/features/editor/hooks/use-editor-draft.hook";
import { readEditorTarget, useEditorOpen } from "@/features/editor/hooks/use-editor-open.hook";
import type { DocContent, StoredDraft } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const DOC = {
  meta: {
    path: "atlas-api/spec.md",
    title: "Spec",
    project: "Atlas API",
    tags: [],
    source: "manual",
    created: "2026-01-01T10:00:00Z",
    mtime: 5,
  },
  body: "# Spec\n\nas saved",
  raw: "",
} as unknown as DocContent;

const PARKED: StoredDraft = {
  body: "# Spec\n\nas typed before the crash",
  meta: { title: "", project: "Atlas API", tags: [], source: "manual" },
  at: "2026-01-02T10:00:00Z",
};

function deferred<T>() {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => (resolve = r));

  return { promise, resolve };
}

const noop = () => ({
  onDoc: vi.fn(),
  onDraft: vi.fn(),
  onRecover: vi.fn(async () => undefined),
});

/** The editor's own wiring: the draft state, opened the way the window opens it. */
function useOpenedEditor() {
  const d = useEditorDraft();
  useEditorOpen(readEditorTarget(), {
    onDoc: d.loadDoc,
    onDraft: d.loadDraft,
    onRecover: d.recoverDraft,
  });

  return d;
}

describe("useEditorOpen", () => {
  it("reads the document once, however often its callbacks are rebuilt", async () => {
    window.location.hash = "#editor?path=atlas-api/spec.md";
    const { invoke } = mockVaultApi({ "doc:read": DOC });
    // `onDoc` is rebuilt on every render here, exactly as it is when the config changes —
    // and the config changes from inside this window when the image panel picks a folder.
    // Re-reading would replace whatever the user had typed.
    const { rerender } = renderHook(() => useEditorOpen(readEditorTarget(), noop()));
    rerender();
    rerender();
    await vi.waitFor(() =>
      expect(invoke.mock.calls.filter((c) => c[0] === "doc:read")).toHaveLength(1),
    );
  });

  it("reads nothing when the hash names no document", () => {
    window.location.hash = "#editor";
    const { invoke } = mockVaultApi();
    renderHook(() => useEditorOpen(readEditorTarget(), noop()));
    expect(invoke).not.toHaveBeenCalledWith("doc:read", expect.anything());
  });

  it("fails loudly when the document can't be read, and recovers nothing over it", async () => {
    window.location.hash = "#editor?path=atlas-api/spec.md";
    mockVaultApi({ "doc:read": new Error("Error invoking remote method 'doc:read': ENOENT") });
    const handlers = noop();
    const { result } = renderHook(() => useEditorOpen(readEditorTarget(), handlers));
    expect(result.current.status.kind).toBe("opening");
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: "failed",
        path: "atlas-api/spec.md",
        reason: "ENOENT",
        retrying: false,
      }),
    );
    expect(handlers.onDoc).not.toHaveBeenCalled();
    expect(handlers.onRecover).not.toHaveBeenCalled();
  });

  it.each([
    ["the file answers first", ["doc", "draft"]],
    ["the parked draft answers first", ["draft", "doc"]],
  ])("keeps the recovered text when %s", async (_, order) => {
    // The bug: both were asked for at once. The draft usually won, then the document
    // landed on top of it, reset `dirty` and threw the recovered text away.
    window.location.hash = "#editor?path=atlas-api/spec.md";
    const doc = deferred<DocContent>();
    const draft = deferred<StoredDraft | null>();
    mockVaultApi({
      "doc:read": () => doc.promise,
      "draft:load": () => draft.promise,
      "doc:pathPreview": () => "",
    });
    const { result } = renderHook(() => useOpenedEditor());
    for (const which of order) {
      if (which === "doc") doc.resolve(DOC);
      else draft.resolve(PARKED);
      await new Promise((r) => setTimeout(r, 0));
    }
    await waitFor(() => expect(result.current.body).toBe(PARKED.body));
    expect(result.current.dirty).toBe(true);
    expect(result.current.existingPath).toBe("atlas-api/spec.md");
    expect(result.current.baseMtime).toBe(5);
  });

  it("pulls the capture sheet's text once it is listening, instead of hoping for an event", async () => {
    // main used to push this on did-finish-load, before the editor had subscribed.
    window.location.hash = "#editor";
    const { invoke } = mockVaultApi({
      "editor:seed": { body: "# From the clipboard", frontmatter: { source: "chatgpt" } },
      "draft:load": PARKED,
      "doc:pathPreview": () => "",
    });
    const { result } = renderHook(() => useOpenedEditor());
    await waitFor(() => expect(result.current.body).toBe("# From the clipboard"));
    expect(result.current.meta.source).toBe("chatgpt");
    expect(result.current.dirty).toBe(true);
    // Fresh text from the sheet is not mixed with an older parked draft.
    expect(invoke).not.toHaveBeenCalledWith("draft:load", expect.anything());
  });

  it("recovers a new window's parked text when nothing was handed to it", async () => {
    window.location.hash = "#editor";
    mockVaultApi({ "editor:seed": null, "draft:load": PARKED, "doc:pathPreview": () => "" });
    const { result } = renderHook(() => useOpenedEditor());
    await waitFor(() => expect(result.current.body).toBe(PARKED.body));
  });
});
