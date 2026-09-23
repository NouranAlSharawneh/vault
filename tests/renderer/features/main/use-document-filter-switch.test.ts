// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  reconcileSelection,
  touchedAt,
  useDocumentFilter,
} from "@/features/main/hooks/use-document-filter.hook";
import type { DocMeta, IndexSnapshot, TrashedDoc } from "@shared/types";

const doc = (path: string, over: Partial<DocMeta> = {}): DocMeta => ({
  title: path,
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path,
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
  ...over,
});
const index: IndexSnapshot = {
  docs: [
    doc("atlas-api/a.md", { created: "2026-09-02T00:00:00Z" }),
    doc("research-log/b.md", { projectSlug: "research-log", project: "Research log" }),
  ],
  projects: [
    { name: "Atlas API", slug: "atlas-api", count: 1 },
    { name: "Research log", slug: "research-log", count: 1 },
  ],
  tags: [],
  orphans: 0,
  headSha: null,
  scannedAt: 0,
};
const trash: TrashedDoc[] = [
  {
    meta: doc(".trash/gone.md"),
    path: ".trash/gone.md",
    originalPath: "atlas-api/gone.md",
    trashedAt: "2026-09-03T00:00:00Z",
  },
];

describe("reconcileSelection", () => {
  const docs = [doc("x"), doc("y")];

  it("keeps a selection that is still in the list", () => {
    expect(reconcileSelection("y", docs)).toBe("y");
  });
  it("falls to the first document when the selection is gone", () => {
    expect(reconcileSelection("elsewhere", docs)).toBe("x");
    expect(reconcileSelection(null, docs)).toBe("x");
  });
  it("clears when the new list is empty", () => {
    expect(reconcileSelection("x", [])).toBeNull();
  });
});

describe("switching collection or project", () => {
  const setup = () => {
    const onSwitch = vi.fn<(docs: DocMeta[]) => void>();
    const hook = renderHook(() => useDocumentFilter(index, trash, onSwitch));

    return { hook, onSwitch };
  };

  it("hands over the list about to be shown, so a live doc can't linger in Trash", () => {
    const { hook, onSwitch } = setup();
    act(() => hook.result.current.selectCollection("trash"));
    expect(onSwitch).toHaveBeenLastCalledWith([trash[0].meta]);
    expect(reconcileSelection("atlas-api/a.md", onSwitch.mock.lastCall![0])).toBe(".trash/gone.md");
  });

  it("does the same for a project", () => {
    const { hook, onSwitch } = setup();
    act(() => hook.result.current.selectProject("research-log"));
    const docs = onSwitch.mock.lastCall![0];
    expect(docs.map((d) => d.path)).toEqual(["research-log/b.md"]);
    expect(hook.result.current.docs).toEqual(docs);
  });

  it("stays quiet for tags and sort, which only narrow or reorder what you're looking at", () => {
    const { hook, onSwitch } = setup();
    act(() => hook.result.current.toggleTag("spec"));
    act(() => hook.result.current.setSort("title"));
    expect(onSwitch).not.toHaveBeenCalled();
  });
});

describe("what the list shows alongside the docs", () => {
  it("offers no tag chips in Trash, where tags don't apply, and keeps them for later", () => {
    const hook = renderHook(() => useDocumentFilter(index, trash));
    act(() => hook.result.current.toggleTag("spec"));
    expect(hook.result.current.activeTags).toEqual(["spec"]);
    act(() => hook.result.current.selectCollection("trash"));
    expect(hook.result.current.activeTags).toEqual([]);
    act(() => hook.result.current.selectCollection("all"));
    expect(hook.result.current.activeTags).toEqual(["spec"]);
  });

  it("dates Recent's rows by last touch, and nothing else's", () => {
    const hook = renderHook(() => useDocumentFilter(index, trash));
    expect(hook.result.current.dateOf).toBeUndefined();
    act(() => hook.result.current.selectCollection("recent"));
    expect(hook.result.current.dateOf).toBe(touchedAt);
  });
});
