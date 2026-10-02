import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ Menu: {}, clipboard: {}, shell: {} }));
import { buildDocRowMenu } from "@main/app/context-menu/doc-row-menu";
import type { DocRowMenuInput } from "@shared/types";

const input = (patch: Partial<DocRowMenuInput> = {}): DocRowMenuInput => ({
  path: "atlas-api/spec.md",
  count: 1,
  starred: false,
  github: true,
  trashed: false,
  ...patch,
});

const labels = (items: Electron.MenuItemConstructorOptions[]) =>
  items.filter((i) => i.label).map((i) => i.label);

describe("a document row's menu", () => {
  it("offers everything a single document can do, and says which item was chosen", () => {
    const choose = vi.fn();
    const items = buildDocRowMenu(input(), choose);
    expect(labels(items)).toEqual([
      "Open in Editor",
      "Star",
      "Reveal in Finder",
      "Copy Path",
      "Open on GitHub",
      "Move to Trash",
    ]);
    const trash = items.find((i) => i.label === "Move to Trash");
    (trash?.click as () => void)();
    expect(choose).toHaveBeenCalledWith("trash");
  });

  it("offers GitHub, but not clickable, for a document that isn't pushed yet", () => {
    const github = buildDocRowMenu(input({ github: false }), vi.fn()).find(
      (i) => i.label === "Open on GitHub",
    );
    expect(github?.enabled).toBe(false);
  });

  it("speaks for the whole selection, and leaves out what only fits one", () => {
    const items = buildDocRowMenu(input({ count: 3, starred: true }), vi.fn());
    expect(labels(items)).toEqual(["Unstar 3 documents", "Move 3 documents to Trash"]);
  });

  it("only reveals or copies a document in the trash", () => {
    expect(labels(buildDocRowMenu(input({ trashed: true }), vi.fn()))).toEqual([
      "Reveal in Finder",
      "Copy Path",
    ]);
  });
});
