import { render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { EditorFooter } from "@/features/editor/components/editor-footer/editor-footer.component";

describe("EditorFooter", () => {
  it("wraps a save error instead of cutting it off", () => {
    const error = "Couldn’t commit — another git process is running in this repository";
    render(
      <EditorFooter
        pathPreview="atlas-api/spec.md"
        hasRemote={false}
        saving={null}
        canSave
        dirty
        error={error}
        keptOtherVersion={false}
        onSave={vi.fn()}
      />,
    );
    const shown = screen.getByText(error);
    expect(shown.className).not.toContain("truncate");
    expect(shown.className).toContain("wrap-break-word");
  });
});
