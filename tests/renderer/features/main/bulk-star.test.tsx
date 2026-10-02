// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBulkActions } from "@/features/main/hooks/use-bulk-actions.hook";
import { useLibrary } from "@/stores/library";
import type { DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

describe("starring the document in the reader", () => {
  it("follows it when the save gives the file its title's name", async () => {
    // Starring `rate-limiting.md` saved it as `rate-limiting-at-the-edge.md`; the reader
    // lost it and jumped to the top of the list.
    mockMarascaApi({
      "doc:setStarred": (path: string) =>
        ({ path: `${path.slice(0, -3)}-at-the-edge.md` }) as DocMeta,
    });
    useLibrary.setState({ selected: "atlas-api/rate-limiting.md" });
    const select = vi.fn((p: string | null) => useLibrary.setState({ selected: p }));
    const { result } = renderHook(() => useBulkActions([], select, vi.fn()));
    await act(() => result.current.star(["atlas-api/rate-limiting.md"], true));
    expect(select).toHaveBeenCalledWith("atlas-api/rate-limiting-at-the-edge.md");
  });

  it("leaves the selection alone for a document that isn't in the reader", async () => {
    mockMarascaApi({ "doc:setStarred": (path: string) => ({ path: `${path}.moved` }) as DocMeta });
    useLibrary.setState({ selected: "other.md" });
    const select = vi.fn();
    const { result } = renderHook(() => useBulkActions([], select, vi.fn()));
    await act(() => result.current.star(["a.md", "b.md"], true));
    expect(select).not.toHaveBeenCalled();
  });
});
