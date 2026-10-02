import { act, renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useAssetPlan } from "@/components/asset-panel";
import { useApp } from "@/stores/app";
import type { AssetRef, AssetResolution, VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../helpers/mock-marasca-api";

const config: VaultConfig = {
  root: "/v",
  remote: null,
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
  assetDirs: { concorde: "/Users/nunu/Coding/concorde" },
};
const BODY = "# X\n\n![a](docs/a.gif)\n![b](docs/big.mp4)\n![c](docs/nope.png)\n";
const FOUND: AssetRef[] = [
  { ref: "docs/a.gif", name: "a.gif", status: "found", bytes: 1024 },
  { ref: "docs/big.mp4", name: "big.mp4", status: "found", bytes: 20 * 1024 * 1024 },
  { ref: "docs/nope.png", name: "nope.png", status: "missing", bytes: 0 },
];
const NOWHERE: AssetRef[] = FOUND.map((r) => ({ ...r, status: "unknown", bytes: 0 }));

/** Stands in for main: a folder it was handed is used as-is, no folder means nothing found. */
const asMain = (baseDir: string | null): AssetResolution => ({
  baseDir,
  detected: false,
  refs: baseDir ? FOUND : NOWHERE,
});

describe("useAssetPlan", () => {
  it("uses the folder remembered for the project and builds the save request", async () => {
    const { invoke } = mockMarascaApi({ "assets:resolve": asMain });
    useApp.setState({ config });
    const { result } = renderHook(() => useAssetPlan({ body: BODY, project: "Concorde" }));
    await waitFor(() => expect(result.current.refs).toHaveLength(3));
    expect(result.current.baseDir).toBe("/Users/nunu/Coding/concorde");
    expect(invoke).toHaveBeenCalledWith("assets:resolve", "/Users/nunu/Coding/concorde", [
      "docs/a.gif",
      "docs/big.mp4",
      "docs/nope.png",
    ]);
    expect(result.current.found).toBe(2);
    expect(result.current.missing).toBe(1);
    expect(result.current.detected).toBe(false);
    // The 20 MB video is left out until asked for: git keeps whatever it's given for good.
    expect(result.current.request).toEqual({
      baseDir: "/Users/nunu/Coding/concorde",
      refs: ["docs/a.gif"],
    });
    expect(result.current.bytes).toBe(1024);

    act(() => result.current.toggle("docs/big.mp4"));
    expect(result.current.request?.refs).toEqual(["docs/a.gif", "docs/big.mp4"]);
  });

  it("adopts the folder main worked out when it was given none", async () => {
    // The capture sheet gets plain text: no source file, nothing remembered for the project.
    // Main is expected to answer with a folder anyway, and the plan must build a request
    // from it without the user ever opening the picker.
    mockMarascaApi({
      "assets:resolve": () => ({
        baseDir: "/Users/nunu/Coding/concorde",
        detected: true,
        refs: FOUND,
      }),
    });
    useApp.setState({ config: { ...config, assetDirs: {} } });
    const { result } = renderHook(() => useAssetPlan({ body: BODY, project: "Concorde" }));
    await waitFor(() => expect(result.current.refs).toHaveLength(3));
    expect(result.current.baseDir).toBe("/Users/nunu/Coding/concorde");
    expect(result.current.detected).toBe(true);
    expect(result.current.request?.refs).toEqual(["docs/a.gif"]);
  });

  it("counts every ref that won't be in the commit, so the sheet can say so", async () => {
    mockMarascaApi({ "assets:resolve": asMain });
    useApp.setState({ config });
    const { result } = renderHook(() => useAssetPlan({ body: BODY, project: "Concorde" }));
    await waitFor(() => expect(result.current.refs).toHaveLength(3));
    expect(result.current.stranded).toBe(2); // the missing one, and the large one not asked for
    act(() => result.current.toggle("docs/big.mp4")); // asking for it brings it along
    expect(result.current.stranded).toBe(1);
    act(() => result.current.toggle("docs/a.gif")); // skipping one strands it
    expect(result.current.stranded).toBe(2);
  });

  it("never copies a file over GitHub's 100 MB limit", async () => {
    const huge = [
      { ref: "docs/huge.mov", name: "huge.mov", status: "found", bytes: 101 * 1024 * 1024 },
    ];
    mockMarascaApi({
      "assets:resolve": () => ({ baseDir: "/src", detected: false, refs: huge }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() =>
      useAssetPlan({ body: "![v](docs/huge.mov)", project: "P" }),
    );
    await waitFor(() => expect(result.current.refs).toHaveLength(1));
    act(() => result.current.toggle("docs/huge.mov"));
    expect(result.current.request).toBeUndefined();
  });

  it("starts each new text with nothing picked or skipped", async () => {
    // The capture sheet is never unmounted: a folder or a skip from one clip carried over.
    mockMarascaApi({ "assets:resolve": asMain });
    useApp.setState({ config });
    const { result, rerender } = renderHook(
      ({ body }) => useAssetPlan({ body, project: "Concorde" }),
      {
        initialProps: { body: BODY },
      },
    );
    await waitFor(() => expect(result.current.refs).toHaveLength(3));
    act(() => result.current.toggle("docs/a.gif"));
    expect(result.current.excluded).toContain("docs/a.gif");
    rerender({ body: `${BODY}\nmore` });
    await waitFor(() => expect(result.current.refs).toHaveLength(3));
    expect(result.current.excluded).not.toContain("docs/a.gif");
  });

  it("says it is still looking, and lets a save wait for the answer", async () => {
    let answer: ((r: AssetResolution) => void) | null = null;
    mockMarascaApi({
      "assets:resolve": () => new Promise<AssetResolution>((r) => (answer = r)),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useAssetPlan({ body: BODY, project: "Concorde" }));
    expect(result.current.pending).toBe(true);
    let waited = false;
    const wait = result.current.whenSettled().then(() => (waited = true));
    await waitFor(() => expect(answer).not.toBeNull());
    await act(async () => answer?.(asMain("/src")));
    await act(() => wait);
    expect(waited).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it("prefers the copied file's folder, and remembers a chosen folder per project", async () => {
    const { invoke } = mockMarascaApi({
      "assets:resolve": asMain,
      "assets:chooseFolder": () => "/Users/nunu/Desktop/shots",
      "vault:updateConfig": () => ({
        ...config,
        assetDirs: { ...config.assetDirs, "atlas-api": "/Users/nunu/Desktop/shots" },
      }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() =>
      useAssetPlan({ body: BODY, project: "Atlas API", sourceDir: "/tmp/src" }),
    );
    await waitFor(() => expect(result.current.baseDir).toBe("/tmp/src"));
    await act(() => result.current.chooseFolder());
    await waitFor(() => expect(result.current.baseDir).toBe("/Users/nunu/Desktop/shots"));
    expect(invoke).toHaveBeenCalledWith("vault:updateConfig", {
      assetDirs: {
        concorde: "/Users/nunu/Coding/concorde",
        "atlas-api": "/Users/nunu/Desktop/shots",
      },
    });
    expect(useApp.getState().config?.assetDirs?.["atlas-api"]).toBe("/Users/nunu/Desktop/shots");
  });

  it("has nothing to do without relative refs, and no request when nothing was found", async () => {
    const { invoke } = mockMarascaApi({ "assets:resolve": asMain });
    useApp.setState({ config: { ...config, assetDirs: {} } });
    const none = renderHook(() => useAssetPlan({ body: "![x](https://a/b.png)", project: "P" }));
    expect(none.result.current.refs).toEqual([]);
    expect(invoke).not.toHaveBeenCalledWith("assets:resolve", expect.anything(), expect.anything());
    const noDir = renderHook(() => useAssetPlan({ body: BODY, project: "P" }));
    await waitFor(() => expect(noDir.result.current.refs).toHaveLength(3));
    expect(noDir.result.current.baseDir).toBeNull();
    expect(noDir.result.current.request).toBeUndefined();
    expect(noDir.result.current.stranded).toBe(3);
  });

  it("sends a pasted image with the save, without listing it or asking for its folder", async () => {
    // A new document has no folder: an image pasted into it was the one thing main could
    // find, and the plan dropped it for want of a base folder.
    const ref = "paste-0a1b2c3d4e5f.png";
    mockMarascaApi({
      "assets:resolve": (): AssetResolution => ({
        baseDir: null,
        detected: false,
        refs: [{ ref, name: ref, status: "found", bytes: 2048 }],
      }),
    });
    useApp.setState({ config: { ...config, assetDirs: {} } });
    const { result } = renderHook(() =>
      useAssetPlan({ body: `# X\n\n![image](${ref})\n`, project: "" }),
    );
    await waitFor(() => expect(result.current.request).toEqual({ baseDir: "", refs: [ref] }));
    expect(result.current.refs).toEqual([]);
    expect(result.current.stranded).toBe(0);
  });

  it("says nothing about images already in the document's own folder, but still sends a new paste", async () => {
    const home = "/v/atlas-api";
    const ref = "paste-0a1b2c3d4e5f.png";
    mockMarascaApi({
      "assets:resolve": (): AssetResolution => ({
        baseDir: home,
        detected: false,
        refs: [
          { ref: "assets/shot.png", name: "shot.png", status: "found", bytes: 900 },
          { ref, name: ref, status: "found", bytes: 2048 },
        ],
      }),
    });
    useApp.setState({ config: { ...config, assetDirs: {} } });
    const body = `# X\n\n![a](assets/shot.png)\n![b](${ref})\n`;
    const { result } = renderHook(() =>
      useAssetPlan({ body, project: "Atlas API", sourceDir: home, homeDir: home }),
    );
    await waitFor(() => expect(result.current.request).toEqual({ baseDir: home, refs: [ref] }));
    expect(result.current.refs).toEqual([]);
  });
});
