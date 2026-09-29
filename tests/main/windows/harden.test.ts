import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { openExternal: vi.fn(async () => undefined) } }));
vi.mock("@electron-toolkit/utils", () => ({ is: { dev: false } }));

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isAppUrl, isSafeExternal } from "@main/windows/harden";

describe("what a window may load and open", () => {
  it("keeps windows on the app's own page, whatever route its hash holds", () => {
    // `harden` resolves the bundled page next to the built main process.
    const page = pathToFileURL(
      join(__dirname, "../../../src/main/windows", "../renderer/index.html"),
    ).href;
    expect(isAppUrl(`${page}#main`)).toBe(true);
    expect(isAppUrl(`${page}#editor?path=a.md`)).toBe(true);
    // A file dropped on a window used to navigate it here, preload and all.
    expect(isAppUrl("file:///Users/nunu/Downloads/README.md")).toBe(false);
    expect(isAppUrl("https://evil.example")).toBe(false);
  });

  it("opens web and mail links outside, and nothing else", () => {
    expect(isSafeExternal("https://github.com")).toBe(true);
    expect(isSafeExternal("mailto:a@b.c")).toBe(true);
    expect(isSafeExternal("file:///Applications/Calculator.app")).toBe(false);
    expect(isSafeExternal("vscode://open")).toBe(false);
  });
});
