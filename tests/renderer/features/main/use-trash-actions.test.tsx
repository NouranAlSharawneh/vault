// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { DocMeta } from "@shared/types";
import { useTrashActions } from "@/features/main/hooks/use-trash-actions.hook";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import { mockVaultApi } from "../../helpers/mock-vault-api";

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
    const { invoke } = mockVaultApi({
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
    const toast = useToast.getState().toast;
    expect(toast?.message).toBe("Moved “Spec” to trash");

    await act(() => toast!.action!.run());
    expect(invoke).toHaveBeenCalledWith("trash:restore", trashed.path);
    expect(select).toHaveBeenLastCalledWith(meta.path);
  });

  it("restores and purges only docs that are in the trash", async () => {
    const { invoke } = mockVaultApi({
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
    expect(useToast.getState().toast?.message).toBe("Restored “Spec”");
    await act(() => inTrash.result.current.purge());
    expect(invoke).toHaveBeenCalledWith("trash:purge", trashed.path);
    expect(useToast.getState().toast?.message).toBe("Deleted “Spec” and 2 images forever");
  });

  it("shows the error when main refuses", async () => {
    mockVaultApi({ "doc:trash": new Error("git is busy") });
    const { result } = renderHook(() => useTrashActions(meta, vi.fn()));
    await act(() => result.current.trash());
    expect(useToast.getState().toast?.message).toBe("git is busy");
  });
});
