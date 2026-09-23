import { describe, expect, it } from "vitest";
import { createEditorRegistry } from "@main/windows/editor-registry";

/** Stand-ins for BrowserWindows: the registry only needs something to tell them apart. */
const win = (name: string) => ({ name });

describe("editor registry", () => {
  it("forgets a window once it closes", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { path: null, draftKey: "untitled:a", seed: { body: "from the clipboard" } });
    editors.add(win("b"), { path: "atlas/spec.md", draftKey: null });
    expect(editors.size()).toBe(2);

    editors.remove(a);
    expect(editors.size()).toBe(1);
    expect(editors.takeSeed(a)).toBeNull();
  });

  it("hands a window its starting text once, so a reload recovers the draft instead", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { path: null, draftKey: "untitled:a", seed: { body: "from the clipboard" } });

    expect(editors.takeSeed(a)).toEqual({ body: "from the clipboard" });
    expect(editors.takeSeed(a)).toBeNull();
    expect(editors.takeSeed(win("stranger"))).toBeNull();
  });

  it("knows which untitled drafts open windows are still writing", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { path: null, draftKey: "untitled:a" });
    editors.add(win("b"), { path: "atlas/spec.md", draftKey: null });

    expect([...editors.heldDraftKeys()]).toEqual(["untitled:a"]);
    editors.remove(a);
    expect(editors.heldDraftKeys().size).toBe(0);
  });

  it("finds the window a document is already open in", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { path: "atlas/spec.md", draftKey: null });
    editors.add(win("b"), { path: null, draftKey: "untitled:b" });

    expect(editors.windowFor("atlas/spec.md")).toBe(a);
    expect(editors.windowFor("atlas/other.md")).toBeNull();
  });

  it("follows a document to the path it was saved or renamed to", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { path: null, draftKey: "untitled:a" });

    // A new document's first save, then a title change that moves the file.
    editors.setPath(a, "inbox/idea.md");
    expect(editors.windowFor("inbox/idea.md")).toBe(a);
    editors.setPath(a, "atlas/idea.md");
    expect(editors.windowFor("inbox/idea.md")).toBeNull();
    expect(editors.windowFor("atlas/idea.md")).toBe(a);
  });

  it("lets a document open again once its window has closed", () => {
    const editors = createEditorRegistry<{ name: string }>();
    const a = win("a");
    editors.add(a, { path: "atlas/spec.md", draftKey: null });
    editors.remove(a);

    expect(editors.windowFor("atlas/spec.md")).toBeNull();
    // A late report from a window that is already gone changes nothing.
    editors.setPath(a, "atlas/spec.md");
    expect(editors.windowFor("atlas/spec.md")).toBeNull();
  });
});
