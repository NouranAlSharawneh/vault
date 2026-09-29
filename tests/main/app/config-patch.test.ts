import { describe, expect, it } from "vitest";
import { sanitizeConfigPatch } from "@main/app/ipc/config-patch";

describe("a settings change from a window", () => {
  it("passes the three settings a window may change", () => {
    expect(
      sanitizeConfigPatch({
        hotkey: "Control+Alt+V",
        pushDebounceMs: 3000,
        assetDirs: { "atlas-api": "/Users/nunu/Code/atlas" },
      }),
    ).toEqual({
      hotkey: "Control+Alt+V",
      pushDebounceMs: 3000,
      assetDirs: { "atlas-api": "/Users/nunu/Code/atlas" },
    });
  });

  it("refuses anything that would move the vault or its remote", () => {
    // Spread straight onto the config, `root` used to be saved and copied onto the running
    // vault, whose folder then disagreed with its own settings.
    expect(() => sanitizeConfigPatch({ root: "/tmp/elsewhere" })).toThrow(/can’t be changed/);
    expect(() => sanitizeConfigPatch({ remote: "someone/else" })).toThrow();
  });

  it("refuses values the app never offers", () => {
    expect(() => sanitizeConfigPatch({ pushDebounceMs: 1 })).toThrow(/push delay/);
    expect(() => sanitizeConfigPatch({ hotkey: "" })).toThrow(/shortcut/);
    expect(() => sanitizeConfigPatch({ hotkey: "V" })).toThrow(/shortcut/);
    expect(() => sanitizeConfigPatch({ assetDirs: { a: "relative/path" } })).toThrow(/full path/);
  });
});
