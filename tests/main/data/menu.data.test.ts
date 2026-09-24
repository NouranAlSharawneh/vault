import { describe, expect, it } from "vitest";
import type { MenuItemData, MenuSectionData } from "@main/app/menu/menu.types";
import { appMenu } from "@main/data/menu.data";

const name = (item: MenuItemData): string =>
  "type" in item ? "---" : "role" in item ? `role:${String(item.role)}` : item.label;
const section = (menu: MenuSectionData[], label: string): string[] =>
  (menu.find((s) => s.label === label)?.items ?? []).map(name);
const everything = (menu: MenuSectionData[]): string[] =>
  menu.flatMap((s) => (s.items ?? []).map(name));

describe("application menu", () => {
  it("keeps Settings and Reset in the app menu on macOS", () => {
    const menu = appMenu("Ctrl+Alt+V", { mac: true, dev: false });
    expect(menu[0]?.label).toBe("Marasca");
    expect(section(menu, "Marasca")).toEqual([
      "role:about",
      "---",
      "Settings…",
      "Reset Marasca…",
      "---",
      "role:services",
      "---",
      "role:hide",
      "role:hideOthers",
      "role:unhide",
      "---",
      "role:quit",
    ]);
    // Once each: not also in View, and never under Help.
    expect(everything(menu).filter((l) => l === "Settings…")).toHaveLength(1);
    expect(everything(menu).filter((l) => l === "Reset Marasca…")).toHaveLength(1);
    expect(section(menu, "Help")).not.toContain("Reset Marasca…");
  });

  it("puts Settings and Reset in File elsewhere", () => {
    const menu = appMenu("Ctrl+Alt+V", { mac: false, dev: false });
    expect(menu.some((s) => s.label === "Marasca")).toBe(false);
    expect(section(menu, "File")).toEqual(expect.arrayContaining(["Settings…", "Reset Marasca…"]));
    expect(section(menu, "Help")).toEqual(["Marasca on GitHub"]);
  });

  it("offers reload and the dev tools only in development", () => {
    const devOnly = ["role:reload", "role:forceReload", "role:toggleDevTools"];
    for (const mac of [true, false]) {
      const release = everything(appMenu("", { mac, dev: false }));
      expect(release.filter((l) => devOnly.includes(l))).toEqual([]);
      expect(section(appMenu("", { mac, dev: true }), "View")).toEqual(
        expect.arrayContaining(devOnly),
      );
    }
  });

  it("never leaves two separators in a row", () => {
    for (const mac of [true, false]) {
      for (const dev of [true, false]) {
        for (const s of appMenu("", { mac, dev })) {
          expect((s.items ?? []).map(name).join(",")).not.toContain("---,---");
        }
      }
    }
  });
});
