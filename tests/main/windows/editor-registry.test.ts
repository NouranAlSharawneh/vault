import { describe, expect, it } from "vitest";
import { createEditorRegistry } from "@main/windows/editor-registry";

/** Stand-ins for BrowserWindows: the registry only needs something to tell them apart. */
const win = (name: string) => ({ name });

describe("editor registry", () => {
  it("forgets a window once it closes", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { seed: { body: "from the clipboard" } });
    editors.add(win("b"), {});
    expect(editors.size()).toBe(2);

    editors.remove(a);
    expect(editors.size()).toBe(1);
    expect(editors.takeSeed(a)).toBeNull();
  });

  it("hands a window its starting text once, so a reload recovers the draft instead", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { seed: { body: "from the clipboard" } });

    expect(editors.takeSeed(a)).toEqual({ body: "from the clipboard" });
    expect(editors.takeSeed(a)).toBeNull();
    expect(editors.takeSeed(win("stranger"))).toBeNull();
  });
});
