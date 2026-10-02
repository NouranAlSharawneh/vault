// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocument } from "@/features/main/hooks/use-document.hook";
import type { DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const meta = (mtime: number) => ({ path: "atlas-api/spec.md", title: "Spec", mtime }) as DocMeta;

describe("useDocument", () => {
  it("reloads the open document when its file changes, without reselecting it", async () => {
    // An editor save lands on the document already selected. Keyed on the path alone,
    // the reader kept the old text until you clicked another document and back.
    let body = "old text";
    const { invoke } = mockMarascaApi({
      "doc:read": (path: string) => ({ meta: meta(1), body, path }),
    });
    const { result, rerender } = renderHook(({ live }) => useDocument("atlas-api/spec.md", live), {
      initialProps: { live: [meta(1)] },
    });
    await waitFor(() => expect(result.current.doc?.body).toBe("old text"));

    body = "new text";
    rerender({ live: [meta(2)] });
    await waitFor(() => expect(result.current.doc?.body).toBe("new text"));
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not read again when nothing about the file changed", async () => {
    const { invoke } = mockMarascaApi({
      "doc:read": () => ({ meta: meta(1), body: "text" }),
    });
    const { result, rerender } = renderHook(({ live }) => useDocument("atlas-api/spec.md", live), {
      initialProps: { live: [meta(1)] },
    });
    await waitFor(() => expect(result.current.doc?.body).toBe("text"));
    rerender({ live: [{ ...meta(1), starred: true }] });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("keeps the last document up while the next one loads, and says when one can't be read", async () => {
    // The reader fell back to "Select a document" between every two clicks, and a file
    // that couldn't be read looked exactly the same.
    let fail = false;
    mockMarascaApi({
      "doc:read": (path: string) => {
        if (fail) throw new Error("EACCES: permission denied");

        return { meta: { ...meta(1), path }, body: `body of ${path}` };
      },
    });
    const { result, rerender } = renderHook(({ path }) => useDocument(path, undefined), {
      initialProps: { path: "a.md" },
    });
    await waitFor(() => expect(result.current.doc?.body).toBe("body of a.md"));
    fail = true;
    rerender({ path: "b.md" });
    expect(result.current.doc).toBeNull();
    expect(result.current.previous?.body).toBe("body of a.md");
    await waitFor(() => expect(result.current.error).toMatch(/permission denied/));
  });
});
