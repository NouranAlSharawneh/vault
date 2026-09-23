import { renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useEditorOpen } from "@/features/editor/hooks/use-editor-open.hook";
import { mockVaultApi } from "../../helpers/mock-vault-api";

describe("useEditorOpen", () => {
  it("reads the document once, however often its callbacks are rebuilt", async () => {
    window.location.hash = "#editor?path=atlas-api/spec.md";
    const { invoke } = mockVaultApi({
      "doc:read": { meta: { path: "atlas-api/spec.md" }, body: "b", raw: "r" },
    });
    // `onDoc` is rebuilt on every render here, exactly as it is when the config changes —
    // and the config changes from inside this window when the image panel picks a folder.
    // Re-reading would replace whatever the user had typed.
    const { rerender } = renderHook(() =>
      useEditorOpen({
        onDoc: () => undefined,
        onDraft: () => undefined,
        onRecover: () => undefined,
      }),
    );
    rerender();
    rerender();
    await vi.waitFor(() =>
      expect(invoke.mock.calls.filter((c) => c[0] === "doc:read")).toHaveLength(1),
    );
  });

  it("reads nothing when the hash names no document", () => {
    window.location.hash = "#editor";
    const { invoke } = mockVaultApi();
    renderHook(() => useEditorOpen({ onDoc: vi.fn(), onDraft: vi.fn(), onRecover: vi.fn() }));
    expect(invoke).not.toHaveBeenCalledWith("doc:read", expect.anything());
  });
});
