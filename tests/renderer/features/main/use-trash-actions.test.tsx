import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useTrashActions } from "@/features/main/hooks/use-trash-actions.hook";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const meta: DocMeta = {
  path: "atlas-api/spec.md",
  projectSlug: "atlas-api",
  title: "Spec",
  project: "Atlas API",
  tags: [],
  created: "2026-01-01T00:00:00Z",
  source: "manual",
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 1,
  orphan: false,
};
const trashed = {
  meta: { ...meta, path: ".trash/atlas-api/spec.md" },
  path: ".trash/atlas-api/spec.md",
  originalPath: meta.path,
  trashedAt: "2026-01-02T00:00:00Z",
};

describe("useTrashActions", () => {
  it("moves the doc to trash, clears the selection and offers Undo", async () => {
    const { invoke } = mockMarascaApi({
      "doc:trash": () => trashed,
      "trash:list": () => [trashed],
      "trash:restore": () => ({ path: meta.path, meta, committed: true }),
    });
    const select = vi.fn();
    const { result } = renderHook(() => useTrashActions(meta, select));
    await act(() => result.current.trash());
    expect(invoke).toHaveBeenCalledWith("doc:trash", meta.path);
    expect(select).toHaveBeenCalledWith(null);
    expect(useApp.getState().trash).toEqual([trashed]);
    const toast = useToast.getState().toasts.at(-1);
    expect(toast?.message).toBe("Moved “Spec” to trash");

    await act(() => toast!.action!.run());
    expect(invoke).toHaveBeenCalledWith("trash:restore", trashed.path);
    expect(select).toHaveBeenLastCalledWith(meta.path);
    // Undo answers like Restore does, rather than the doc silently reappearing.
    expect(useToast.getState().toasts.at(-1)?.message).toBe("Restored “Spec”");
  });

  it("restores and purges only docs that are in the trash", async () => {
    const { invoke } = mockMarascaApi({
      "trash:restore": () => ({ path: meta.path, meta, committed: true }),
      "trash:purge": () => ({ removed: 1, assets: ["p/assets/a.gif", "p/assets/b.png"] }),
      "trash:list": () => [],
    });
    const select = vi.fn();
    const live = renderHook(() => useTrashActions(meta, select));
    await act(() => live.result.current.restore());
    await act(() => live.result.current.purge());
    expect(invoke).not.toHaveBeenCalledWith("trash:restore", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("trash:purge", expect.anything());

    const inTrash = renderHook(() => useTrashActions(trashed.meta, select));
    await act(() => inTrash.result.current.restore());
    expect(invoke).toHaveBeenCalledWith("trash:restore", trashed.path);
    expect(useToast.getState().toasts.at(-1)?.message).toBe("Restored “Spec”");
    await act(() => inTrash.result.current.purge());
    expect(invoke).toHaveBeenCalledWith("trash:purge", trashed.path);
    expect(useToast.getState().toasts.at(-1)?.message).toBe(
      "Deleted “Spec” and 2 images from the vault",
    );
  });

  it("changes nothing when the confirmation is declined", async () => {
    // Main asks before deleting forever; answering no comes back as removed: 0. That has
    // to leave the selection and the toast exactly where they were.
    mockMarascaApi({ "trash:purge": { removed: 0, assets: [] } });
    useToast.getState().dismiss();
    const select = vi.fn();
    const { result } = renderHook(() => useTrashActions(trashed.meta, select));
    await act(() => result.current.purge());
    expect(select).not.toHaveBeenCalled();
    expect(useToast.getState().toasts).toEqual([]);
  });

  it("shows the error when main refuses", async () => {
    const { invoke } = mockMarascaApi({ "doc:trash": new Error("git is busy") });
    const { result } = renderHook(() => useTrashActions(meta, vi.fn()));
    await act(() => result.current.trash());
    expect(useToast.getState().toasts.at(-1)?.message).toBe("git is busy");
    // A failure lets go of the guard, or the button would spin, disabled, for good.
    expect(result.current.busy).toBeNull();
    await act(() => result.current.trash());
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("trashes once while the first trash is still in flight", async () => {
    const answers: ((t: typeof trashed) => void)[] = [];
    const { invoke } = mockMarascaApi({
      "doc:trash": () => new Promise((resolve) => answers.push(resolve)),
      "trash:list": () => [trashed],
    });
    const { result } = renderHook(() => useTrashActions(meta, vi.fn()));
    let clicks!: Promise<void>[];
    // A double-click, or ⌘⌫ then the palette — both before main has answered, and before
    // React has re-rendered the button as disabled.
    act(() => {
      clicks = [result.current.trash(), result.current.trash()];
    });
    expect(result.current.busy).toBe("trash");
    expect(invoke.mock.calls.filter(([channel]) => channel === "doc:trash")).toHaveLength(1);

    await act(async () => {
      for (const answer of answers) answer(trashed);
      await Promise.all(clicks);
    });
    expect(result.current.busy).toBeNull();
    expect(useToast.getState().toasts.at(-1)?.message).toBe("Moved “Spec” to trash");
  });

  it("moves the selection to the next document instead of leaving the reader blank", async () => {
    mockMarascaApi({
      "doc:trash": () => ({ ...trashed, meta: { ...meta } }),
      "trash:list": () => [],
    });
    const select = vi.fn();
    const { result } = renderHook(() =>
      useTrashActions(meta, select, (path) => (path === meta.path ? "p/next.md" : null)),
    );
    await act(() => result.current.trash());
    expect(select).toHaveBeenCalledWith("p/next.md");
  });
});
