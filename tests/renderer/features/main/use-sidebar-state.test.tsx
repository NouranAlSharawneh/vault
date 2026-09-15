import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useSidebarState } from "@/features/main/hooks/use-sidebar-state.hook";
import { mockVaultApi } from "../../helpers/mock-vault-api";

describe("useSidebarState", () => {
  it("cycles full → rail → hidden → full, via ⌘\\ too, and persists", () => {
    localStorage.removeItem("sidebar-state");
    const { emit } = mockVaultApi();
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
