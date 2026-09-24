import { describe, expect, it } from "vitest";
import type { CaptureHideReason } from "@main/windows/capture.window.types";
import { shouldHideApp } from "@main/windows/should-hide-app";

const hide = (reason: CaptureHideReason, summonedFromAnotherApp: boolean, otherWindows: boolean) =>
  shouldHideApp({ reason, summonedFromAnotherApp, otherWindows });

describe("shouldHideApp", () => {
  it("Esc / ⌘↵ return to the app the sheet was summoned over, even with Marasca open", () => {
    expect(hide("dismiss", true, true)).toBe(true);
    expect(hide("dismiss", true, false)).toBe(true);
  });

  it("Esc / ⌘↵ leave focus in Marasca when Marasca was already in front", () => {
    expect(hide("dismiss", false, true)).toBe(false);
  });

  it("with no Marasca window left, the app hides whatever the reason, bar a handoff", () => {
    expect(hide("dismiss", false, false)).toBe(true);
    expect(hide("blur", false, false)).toBe(true);
    expect(hide("blur", true, false)).toBe(true);
  });

  it("a blur never hides a Marasca window the user can still see", () => {
    expect(hide("blur", true, true)).toBe(false);
    expect(hide("blur", false, true)).toBe(false);
  });

  it("⌥⌘↵ and Open in editor never hide Marasca — it is about to show something", () => {
    for (const summoned of [true, false])
      for (const others of [true, false]) expect(hide("handoff", summoned, others)).toBe(false);
  });
});
