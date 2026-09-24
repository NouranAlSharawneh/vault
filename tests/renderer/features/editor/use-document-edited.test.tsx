import { renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useDocumentEdited } from "@/features/editor/hooks/use-document-edited.hook";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

describe("useDocumentEdited", () => {
  it("tells the window each time the draft becomes dirty or clean, and only then", () => {
    const { invoke } = mockMarascaApi();
    const { rerender } = renderHook(({ dirty }) => useDocumentEdited(dirty), {
      initialProps: { dirty: false },
    });
    rerender({ dirty: true });
    rerender({ dirty: true });
    rerender({ dirty: false });
    expect(invoke.mock.calls).toEqual([
      ["window:setEdited", false],
      ["window:setEdited", true],
      ["window:setEdited", false],
    ]);
  });
});
