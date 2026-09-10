// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCapture } from "@/features/capture/hooks/use-capture.hook";
import { useApp } from "@/stores/app";
import type { ClipboardCapture } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const clip: ClipboardCapture = {
  text: "# Pasted spec\n\nbody",
  words: 3,
  lines: 3,
  looksLikeMarkdown: true,
  detectedSource: "chatgpt",
  detectedTitle: "Pasted spec",
};
const config = {
  root: "/v",
  remote: "nunu/vault",
  branch: "main",
  lastProject: "Atlas API",
  lastSource: "claude" as const,
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

describe("useCapture", () => {
  it("pre-fills from the clipboard analysis and last-used project, previews the path", async () => {
    mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "atlas-api/pasted-spec.md",
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.form).toEqual({ project: "Atlas API", source: "chatgpt", tags: [] });
    expect(result.current.title).toBe("Pasted spec");
    await waitFor(() => expect(result.current.pathPreview).toBe("atlas-api/pasted-spec.md"));
  });

  it("empty clipboard → empty phase; a later capture:shown event fills it", async () => {
    const empty = { ...clip, text: "", words: 0, lines: 1, detectedTitle: null };
    const { emit } = mockVaultApi({
      "capture:readClipboard": () => empty,
      "doc:pathPreview": () => "",
    });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.clip).not.toBeNull());
    expect(result.current.phase).toBe("empty");
    act(() => emit("capture:shown", clip));
    expect(result.current.phase).toBe("ready");
  });

  it("⌘↵ saves with commit, then opens the new doc in the main window", async () => {
    const { invoke } = mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "doc:save": () => ({ path: "atlas-api/pasted-spec.md", committed: true, meta: {} }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("saved");
    const call = invoke.mock.calls.find((c) => c[0] === "doc:save")!;
    expect(call[1]).toMatchObject({
      commit: true,
      frontmatter: { title: "Pasted spec", project: "Atlas API", source: "chatgpt" },
    });
    // The sheet hands the saved path to the main window rather than just hiding.
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("capture:reveal", "atlas-api/pasted-spec.md"),
    );
  });

  it("a failed save shows the error and can retry", async () => {
    mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "doc:save": new Error("boom"),
    });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("boom");
    act(() => result.current.retry());
    expect(result.current.phase).toBe("ready");
  });
});
