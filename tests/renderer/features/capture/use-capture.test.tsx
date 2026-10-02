import { act, renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_SAVED_FLASH_MS } from "@/constants";
import { forgetUnsavedCaptures, useCapture } from "@/features/capture/hooks/use-capture.hook";
import { useApp } from "@/stores/app";
import type { ClipboardCapture } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

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
    mockMarascaApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "atlas-api/pasted-spec.md",
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.form).toEqual({
      title: "Pasted spec",
      titleEdited: false,
      project: "Atlas API",
      source: "chatgpt",
      tags: [],
      variant: "raw",
    });
    expect(result.current.title).toBe("Pasted spec");
    await waitFor(() => expect(result.current.pathPreview).toBe("atlas-api/pasted-spec.md"));
  });

  it("empty clipboard → empty phase; a later capture:shown event fills it", async () => {
    const empty = { ...clip, text: "", words: 0, lines: 1, detectedTitle: null };
    const { emit } = mockMarascaApi({
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
    mockMarascaApi({
      "capture:readClipboard": () => new Promise<ClipboardCapture>((r) => (answer = r)),
      "doc:pathPreview": () => "",
    });
    const { result } = renderHook(() => useCapture());
    expect(result.current.phase).toBe("loading");
    await act(async () => answer(clip));
    expect(result.current.phase).toBe("ready");
  });

  it("forgets the last show when hidden, so the next one doesn't flash “saved”", async () => {
    const { emit } = mockMarascaApi({
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
    const { emit } = mockMarascaApi({
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
    mockMarascaApi({ "capture:readClipboard": () => clip, "doc:pathPreview": () => "" });
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
    const api = mockMarascaApi({
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

  const channels = (invoke: ReturnType<typeof mockMarascaApi>["invoke"]) =>
    invoke.mock.calls.map((c) => c[0]);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("⌘↵ saves with commit, flashes, then hides the sheet without opening Marasca", async () => {
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

  it("a sheet dismissed during the saved flash does not then open Marasca", async () => {
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

  it("a failed save shows the error, and Try again saves again", async () => {
    // Try again only cleared the error; the save then needed a second, separate ⌘↵.
    let fail = true;
    const { invoke } = mockMarascaApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "doc:save": () => {
        if (fail) throw new Error("boom");

        return { path: "inbox/x.md", meta: { path: "inbox/x.md" }, committed: true };
      },
    });
    const { result } = renderHook(() => useCapture());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("boom");
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.phase).toBe("saved"));
    expect(invoke.mock.calls.filter((c) => c[0] === "doc:save")).toHaveLength(2);
  });
});

/** A document last written on the `day`th of September. */
function doc(path: string, project: string, projectSlug: string, day: number) {
  return {
    title: path,
    project,
    projectSlug,
    tags: [],
    created: "2026-01-01T00:00:00Z",
    source: "claude" as const,
    path,
    excerpt: "",
    words: 1,
    mtime: Date.UTC(2026, 8, day),
    size: 0,
    orphan: false,
  };
}

describe("useCapture — the title, the page's formatting, and what's remembered", () => {
  const page: ClipboardCapture = {
    text: "Setup guide\nInstall it\nThen run it",
    words: 7,
    lines: 3,
    looksLikeMarkdown: false,
    detectedSource: "manual",
    detectedTitle: "Setup guide (plain)",
    converted: "# Setup guide\n\n- Install it\n- Then run it",
  };

  afterEach(() => forgetUnsavedCaptures());

  const ready = async (c: ClipboardCapture, answers = {}) => {
    const api = mockMarascaApi({
      "capture:readClipboard": () => c,
      "doc:pathPreview": () => "",
      "doc:save": () => ({ path: "atlas-api/setup-guide.md", committed: true, meta: {} }),
      ...answers,
    });
    useApp.setState({ config, index: null });
    const hook = renderHook(() => useCapture());
    await waitFor(() => expect(hook.result.current.phase).toBe("ready"));

    return { ...api, ...hook };
  };

  it("saves the converted page by default, under the title the user typed", async () => {
    const { invoke, result } = await ready(page);
    expect(result.current.form.variant).toBe("converted");
    expect(result.current.text).toBe(page.converted);
    expect(result.current.form.title).toBe("Setup guide");
    act(() => result.current.setTitle("Onboarding checklist"));
    await act(async () => {
      await result.current.save();
    });
    expect(invoke.mock.calls.find((c) => c[0] === "doc:save")![1]).toMatchObject({
      body: page.converted,
      frontmatter: { title: "Onboarding checklist" },
    });
  });

  it("saves the text as copied when asked, the title following it until typed", async () => {
    const { invoke, result } = await ready(page);
    act(() => result.current.setVariant("raw"));
    expect(result.current.form.title).toBe("Setup guide (plain)");
    act(() => result.current.setTitle("Mine"));
    act(() => result.current.setVariant("converted"));
    expect(result.current.form.title).toBe("Mine");
    act(() => result.current.setVariant("raw"));
    await act(async () => {
      await result.current.save();
    });
    expect(invoke.mock.calls.find((c) => c[0] === "doc:save")![1]).toMatchObject({
      body: page.text,
      frontmatter: { title: "Mine" },
    });
  });

  it("gives a dismissed clip back its form when shown again, until it is saved", async () => {
    // Esc, a click elsewhere or the hotkey again threw away the project and tags chosen.
    const { emit, result } = await ready(clip);
    act(() => result.current.setForm({ project: "Research log", tags: ["idea"] }));
    act(() => emit("capture:hidden", null));
    act(() => emit("capture:shown", clip));
    await waitFor(() => expect(result.current.form.project).toBe("Research log"));
    expect(result.current.form.tags).toEqual(["idea"]);

    // Another clip starts fresh…
    act(() => emit("capture:hidden", null));
    act(() => emit("capture:shown", { ...clip, text: "# Something else" }));
    await waitFor(() => expect(result.current.clip?.text).toBe("# Something else"));
    expect(result.current.form.tags).toEqual([]);

    // …and once the first is saved, it is forgotten.
    act(() => emit("capture:hidden", null));
    act(() => emit("capture:shown", clip));
    await waitFor(() => expect(result.current.form.tags).toEqual(["idea"]));
    await act(async () => {
      await result.current.save();
    });
    act(() => emit("capture:hidden", null));
    act(() => emit("capture:shown", clip));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.form.tags).toEqual([]);
  });

  it("gets out of the way at once when main says it with a notification", async () => {
    const { invoke, result } = await ready(clip, { "capture:saved": () => true });
    await act(async () => {
      await result.current.save();
    });
    expect(invoke).toHaveBeenCalledWith("capture:saved", "atlas-api/setup-guide.md", "Pasted spec");
    // Main hid the sheet itself: no "saved" flash, and no second hide from here.
    expect(result.current.phase).not.toBe("saved");
    expect(invoke.mock.calls.map((c) => c[0])).not.toContain("capture:hide");
  });

  it("numbers recent projects, and ⌘N picks the Nth", async () => {
    const { result } = await ready(clip);
    act(() =>
      useApp.setState({
        index: {
          docs: [
            doc("research-log/a.md", "Research log", "research-log", 3),
            doc("onboarding-v2/b.md", "Onboarding v2", "onboarding-v2", 2),
            doc("atlas-api/c.md", "Atlas API", "atlas-api", 1),
          ],
          projects: [
            { name: "Atlas API", slug: "atlas-api", count: 1 },
            { name: "Onboarding v2", slug: "onboarding-v2", count: 1 },
            { name: "Research log", slug: "research-log", count: 1 },
          ],
          tags: [{ tag: "infra", count: 4 }],
          orphans: 0,
          headSha: null,
          scannedAt: 0,
        },
      }),
    );
    // The last project captured into leads; the rest by their latest document.
    expect(result.current.recents).toEqual(["Atlas API", "Research log", "Onboarding v2"]);
    act(() => result.current.pickProject(3));
    expect(result.current.form.project).toBe("Onboarding v2");
  });
});
