import { render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { EditorFooter } from "@/features/editor/components/editor-footer/editor-footer.component";
import type { EditorFooterProps } from "@/features/editor/components/editor-footer/editor-footer.types";

const footer = (overrides: Partial<EditorFooterProps>) =>
  render(
    <EditorFooter
      pathPreview="inbox/untitled.md"
      hasRemote={false}
      branch="main"
      saving={null}
      canSave={false}
      dirty={false}
      persisted={false}
      error={null}
      keptOtherVersion={false}
      onSave={vi.fn()}
      {...overrides}
    />,
  );

describe("EditorFooter", () => {
  it("does not call a new document that was never saved 'Saved'", () => {
    footer({ persisted: false });
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("says 'Saved' for a document on disk with no changes", () => {
    footer({ persisted: true });
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("drops 'Saved' as soon as there are unsaved changes", () => {
    footer({ persisted: true, dirty: true });
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("EditorFooter errors", () => {
  it("gives a save error its own row, in plain words, with the original a hover away", () => {
    const error = "EACCES: permission denied, open '/var/folders/xy/T/vault/a.md'";
    footer({ canSave: true, dirty: true, error });
    const shown = screen.getByRole("alert");
    expect(shown.textContent).toMatch(/isn’t allowed to write to the vault folder/);
    expect(shown.getAttribute("title")).toBe(error);
    expect(shown.className).not.toContain("truncate");
  });
});
