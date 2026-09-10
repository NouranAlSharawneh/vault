// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEditorDraft } from "@/features/editor/hooks/use-editor-draft.hook";
import { useApp } from "@/stores/app";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const config = {
  root: "/tmp/v",
  remote: "nunu/vault",
  branch: "main",
  lastProject: "Atlas API",
  lastSource: "claude" as const,
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

describe("useEditorDraft", () => {
  it("infers the title from the first heading and previews the path", async () => {
    mockVaultApi({ "doc:pathPreview": () => "atlas-api/rate-limiting-at-the-edge.md" });
    useApp.setState({ config });
    const { result } = renderHook(() => useEditorDraft());
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
    mockVaultApi({ "doc:pathPreview": () => "" });
    const { result } = renderHook(() => useEditorDraft());
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
    const { invoke } = mockVaultApi({
      "doc:pathPreview": () => "atlas-api/doc.md",
      "doc:save": () => ({ path: "atlas-api/doc.md", meta, committed: true }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useEditorDraft());
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
    mockVaultApi({ "doc:pathPreview": () => "", "doc:save": new Error("git is not installed") });
    const { result } = renderHook(() => useEditorDraft());
    act(() => result.current.setBody("text"));
    await act(async () => {
      await result.current.save("local");
    });
    expect(result.current.error).toBe("git is not installed");
    expect(result.current.dirty).toBe(true);
  });

  it("loadDraft pre-fills from the capture payload and the last-used project", () => {
    mockVaultApi({ "doc:pathPreview": () => "" });
    useApp.setState({ config });
    const { result } = renderHook(() => useEditorDraft());
    act(() => result.current.loadDraft({ body: "# Pasted", frontmatter: { source: "chatgpt" } }));
    expect(result.current.meta.project).toBe("Atlas API");
    expect(result.current.meta.source).toBe("chatgpt");
    expect(result.current.dirty).toBe(true);
  });
});
