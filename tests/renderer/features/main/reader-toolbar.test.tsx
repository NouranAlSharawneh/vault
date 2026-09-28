// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReaderToolbar } from "@/features/main/components/reader-toolbar/reader-toolbar.component";
import type { ReaderToolbarProps } from "@/features/main/components/reader-toolbar/reader-toolbar.types";
import type { DocMeta } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const doc: DocMeta = {
  path: "atlas-api/spec.md",
  projectSlug: "atlas-api",
  title: "Spec",
  project: "Atlas API",
  tags: [],
  created: "2026-01-01T00:00:00Z",
  source: "manual",
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 1,
  orphan: false,
};

function toolbar(props: Partial<ReaderToolbarProps> = {}) {
  mockMarascaApi();
  render(
    <ReaderToolbar
      doc={doc}
      view="preview"
      onView={vi.fn()}
      onStar={vi.fn()}
      onTrash={vi.fn()}
      onHistory={vi.fn()}
      onRestore={vi.fn()}
      onPurge={vi.fn()}
      {...props}
    />,
  );
}

const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>("button", { name });

describe("ReaderToolbar", () => {
  it("disables Move to trash while the trash is under way", () => {
    toolbar({ trashBusy: "trash" });
    expect(button("move to trash").disabled).toBe(true);
  });

  it("offers Move to trash when nothing is in flight", () => {
    toolbar({ trashBusy: null });
    expect(button("move to trash").disabled).toBe(false);
  });

  it("disables Restore and Delete forever while either one runs", () => {
    toolbar({ doc: { ...doc, path: `.trash/${doc.path}` }, trashed: true, trashBusy: "purge" });
    expect(button(/Restore/).disabled).toBe(true);
    expect(button(/Delete forever/).disabled).toBe(true);
  });
});
