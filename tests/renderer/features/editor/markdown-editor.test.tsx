import { render } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "@/features/editor/components/markdown-editor/markdown-editor.component";

function mount() {
  const { container } = render(
    <MarkdownEditor value={"# Title\n\nBody"} onChange={vi.fn()} autoFocus />,
  );
  const content = container.querySelector(".cm-content");
  if (!content) throw new Error("CodeMirror did not mount");

  return { container, content };
}

describe("MarkdownEditor", () => {
  it("paints no active-line band under the cursor", () => {
    const { container } = mount();
    expect(container.querySelector(".cm-activeLine")).toBeNull();
  });
});
