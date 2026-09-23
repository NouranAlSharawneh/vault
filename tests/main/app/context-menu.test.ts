import { describe, expect, it, vi } from "vitest";
import { buildContextMenu } from "@main/app/context-menu/build-context-menu";
import type { ContextMenuInput } from "@main/app/context-menu/context-menu.types";

const ALL_EDITS = {
  canUndo: true,
  canRedo: true,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: false,
};

const click = (overrides: Partial<ContextMenuInput>): ContextMenuInput => ({
  isEditable: false,
  selectionText: "",
  misspelledWord: "",
  dictionarySuggestions: [],
  editFlags: ALL_EDITS,
  ...overrides,
});

const actions = () => ({ replaceMisspelling: vi.fn(), addToDictionary: vi.fn() });
const summary = (items: Electron.MenuItemConstructorOptions[]) =>
  items.map((i) => i.role ?? i.label ?? i.type);

describe("buildContextMenu", () => {
  it("offers the dictionary's guesses and Add to dictionary over a misspelled word", () => {
    const a = actions();
    const items = buildContextMenu(
      click({ isEditable: true, misspelledWord: "teh", dictionarySuggestions: ["the", "tech"] }),
      a,
    );

    expect(summary(items)).toEqual([
      "the",
      "tech",
      "Add to dictionary",
      "separator",
      "cut",
      "copy",
      "paste",
      "separator",
      "selectAll",
    ]);
    items[1].click?.({} as Electron.MenuItem, undefined, {} as Electron.KeyboardEvent);
    expect(a.replaceMisspelling).toHaveBeenCalledWith("tech");
    items[2].click?.({} as Electron.MenuItem, undefined, {} as Electron.KeyboardEvent);
    expect(a.addToDictionary).toHaveBeenCalledWith("teh");
  });

  it("says so when the dictionary has no guesses", () => {
    const items = buildContextMenu(click({ isEditable: true, misspelledWord: "qzxv" }), actions());

    expect(items[0]).toEqual({ label: "No guesses found", enabled: false });
    expect(summary(items)).toContain("Add to dictionary");
  });

  it("gives a field the edit roles, enabled by what the field allows", () => {
    const items = buildContextMenu(
      click({ isEditable: true, editFlags: { ...ALL_EDITS, canCut: false, canCopy: false } }),
      actions(),
    );

    expect(summary(items)).toEqual(["cut", "copy", "paste", "separator", "selectAll"]);
    expect(items.find((i) => i.role === "cut")?.enabled).toBe(false);
    expect(items.find((i) => i.role === "paste")?.enabled).toBe(true);
  });

  it("offers only Copy over selected text outside a field", () => {
    expect(summary(buildContextMenu(click({ selectionText: "some words" }), actions()))).toEqual([
      "copy",
    ]);
  });

  it("offers nothing where there is nothing to act on", () => {
    expect(buildContextMenu(click({ selectionText: "  " }), actions())).toEqual([]);
  });
});
