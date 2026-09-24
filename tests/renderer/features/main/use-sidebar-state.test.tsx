import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useSidebarState } from "@/features/main/hooks/use-sidebar-state.hook";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

describe("useSidebarState", () => {
  it("cycles full → rail → hidden → full, via ⌘\\ too, and persists", () => {
    localStorage.removeItem("sidebar-state");
    const { emit } = mockMarascaApi();
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.state).toBe("full");
    act(() => result.current.cycle());
    expect(result.current.state).toBe("rail");
    act(() => emit("shortcut", "toggleSidebar"));
    expect(result.current.state).toBe("hidden");
    act(() => result.current.cycle());
    expect(result.current.state).toBe("full");
    expect(localStorage.getItem("sidebar-state")).toBe("full");
  });
});
