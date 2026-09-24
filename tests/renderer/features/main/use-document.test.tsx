// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocument } from "@/features/main/hooks/use-document.hook";
import type { DocMeta } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const meta = (mtime: number) => ({ path: "atlas-api/spec.md", title: "Spec", mtime }) as DocMeta;

describe("useDocument", () => {
  it("reloads the open document when its file changes, without reselecting it", async () => {
    // An editor save lands on the document already selected. Keyed on the path alone,
    // the reader kept the old text until you clicked another document and back.
    let body = "old text";
    const { invoke } = mockVaultApi({
      "doc:read": (path: string) => ({ meta: meta(1), body, path }),
    });
    const { result, rerender } = renderHook(({ live }) => useDocument("atlas-api/spec.md", live), {
      initialProps: { live: [meta(1)] },
    });
    await waitFor(() => expect(result.current?.body).toBe("old text"));

    body = "new text";
    rerender({ live: [meta(2)] });
    await waitFor(() => expect(result.current?.body).toBe("new text"));
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not read again when nothing about the file changed", async () => {
    const { invoke } = mockVaultApi({
      "doc:read": () => ({ meta: meta(1), body: "text" }),
    });
    const { result, rerender } = renderHook(({ live }) => useDocument("atlas-api/spec.md", live), {
      initialProps: { live: [meta(1)] },
    });
    await waitFor(() => expect(result.current?.body).toBe("text"));
    rerender({ live: [{ ...meta(1), starred: true }] });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
