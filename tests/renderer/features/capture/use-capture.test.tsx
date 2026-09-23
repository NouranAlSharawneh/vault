import { act, renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_SAVED_FLASH_MS } from "@/constants";
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
    await waitFor(() => expect(result.current.phase).toBe("ready"));
  });

  it("stays quiet until the clipboard has been read, instead of flashing “empty”", async () => {
    let answer: (c: ClipboardCapture) => void = () => undefined;
    mockVaultApi({
      "capture:readClipboard": () => new Promise<ClipboardCapture>((r) => (answer = r)),
      "doc:pathPreview": () => "",
    });
    const { result } = renderHook(() => useCapture());
    expect(result.current.phase).toBe("loading");
    await act(async () => answer(clip));
    expect(result.current.phase).toBe("ready");
  });

  it("forgets the last show when hidden, so the next one doesn't flash “saved”", async () => {
    const { emit } = mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "doc:save": () => ({ path: "atlas-api/pasted-spec.md", committed: true, meta: {} }),
    });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("saved");
    act(() => emit("capture:hidden", null));
    expect(result.current.phase).toBe("loading");
    expect(result.current.clip).toBeNull();
  });

  it("prefills the project saved last, even when that save happened after boot", async () => {
    // The sheet lives for the whole session. Main moves `lastProject` on with every save;
    // the copy the sheet read at boot does not.
    const { emit } = mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "vault:config": () => ({ ...config, lastProject: "Research log" }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.form.project).toBe("Atlas API");
    act(() => emit("capture:shown", clip));
    await waitFor(() => expect(result.current.form.project).toBe("Research log"));
    expect(result.current.lastProject).toBe("Research log");
  });

  it("keeps what the user typed when config arrives mid-edit", async () => {
    mockVaultApi({ "capture:readClipboard": () => clip, "doc:pathPreview": () => "" });
    useApp.setState({ config });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    act(() => result.current.setForm({ project: "Onboarding v2", tags: ["infra"] }));
    act(() => useApp.setState({ config: { ...config, lastProject: "Research log" } }));
    expect(result.current.form).toMatchObject({ project: "Onboarding v2", tags: ["infra"] });
  });

  const saved = { path: "atlas-api/pasted-spec.md", committed: true, meta: {} };

  /** Render ready to save, then freeze the clock so the "saved" flash can be stepped. */
  async function readyToSave() {
    const api = mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "doc:save": () => saved,
    });
    useApp.setState({ config });
    const hook = renderHook(() => useCapture());
    await waitFor(() => expect(hook.result.current.phase).toBe("ready"));
    vi.useFakeTimers();

    return { ...api, ...hook };
  }

  const channels = (invoke: ReturnType<typeof mockVaultApi>["invoke"]) =>
    invoke.mock.calls.map((c) => c[0]);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("⌘↵ saves with commit, flashes, then hides the sheet without opening Vault", async () => {
    const { invoke, result } = await readyToSave();
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("saved");
    const call = invoke.mock.calls.find((c) => c[0] === "doc:save")!;
    expect(call[1]).toMatchObject({
      commit: true,
      frontmatter: { title: "Pasted spec", project: "Atlas API", source: "chatgpt" },
    });
    // Nothing moves while "saved" is on screen…
    expect(channels(invoke)).not.toContain("capture:hide");
    act(() => vi.advanceTimersByTime(CAPTURE_SAVED_FLASH_MS));
    // …then the sheet goes, focus returns to the app the clip came from, and the main
    // window is left alone.
    expect(invoke).toHaveBeenCalledWith("capture:hide");
    expect(channels(invoke)).not.toContain("capture:reveal");
  });

  it("⌥⌘↵ saves, then opens the new doc in the main window", async () => {
    const { invoke, result } = await readyToSave();
    await act(async () => {
      await result.current.save(true);
    });
    act(() => vi.advanceTimersByTime(CAPTURE_SAVED_FLASH_MS));
    expect(invoke).toHaveBeenCalledWith("capture:reveal", "atlas-api/pasted-spec.md");
    expect(channels(invoke)).not.toContain("capture:hide");
  });

  it("a sheet dismissed during the saved flash does not then open Vault", async () => {
    const { invoke, emit, result } = await readyToSave();
    await act(async () => {
      await result.current.save(true);
    });
    // The user clicked back into the app they came from; the sheet hid on blur.
    act(() => emit("capture:hidden", null));
    act(() => vi.advanceTimersByTime(CAPTURE_SAVED_FLASH_MS * 2));
    expect(channels(invoke)).not.toContain("capture:reveal");
    expect(channels(invoke)).not.toContain("capture:hide");
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
