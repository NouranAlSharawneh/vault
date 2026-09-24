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
    expect(result.current.request).toEqual({
      baseDir: "/Users/nunu/Coding/concorde",
      refs: ["docs/a.gif", "docs/big.mp4"],
    });

    act(() => result.current.toggle("docs/big.mp4"));
    expect(result.current.request?.refs).toEqual(["docs/a.gif"]);
    expect(result.current.bytes).toBe(1024);
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
    expect(result.current.request?.refs).toEqual(["docs/a.gif", "docs/big.mp4"]);
  });

  it("counts every ref that won't be in the commit, so the sheet can say so", async () => {
    mockMarascaApi({ "assets:resolve": asMain });
    useApp.setState({ config });
    const { result } = renderHook(() => useAssetPlan({ body: BODY, project: "Concorde" }));
    await waitFor(() => expect(result.current.refs).toHaveLength(3));
    expect(result.current.stranded).toBe(1); // the missing one
    act(() => result.current.toggle("docs/big.mp4")); // skipping one strands it too
    expect(result.current.stranded).toBe(2);
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
});
