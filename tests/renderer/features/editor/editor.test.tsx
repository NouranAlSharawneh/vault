import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@/features/editor/editor.component";
import { useApp } from "@/stores/app";
import type { StoredDraft } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const config = {
  root: "/tmp/v",
  remote: null,
  branch: "main",
  lastProject: "Atlas API",
  lastSource: "claude" as const,
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

const PARKED: StoredDraft = {
  body: "# Half a thought",
  meta: { title: "", project: "", tags: [], source: "claude" },
  at: "2026-01-01",
};

const docSaves = (invoke: ReturnType<typeof mockVaultApi>["invoke"]) =>
  invoke.mock.calls.filter((c) => c[0] === "doc:save");

describe("Editor", () => {
  beforeAll(() => {
    // CodeMirror measures text; jsdom has no layout, so give it empty boxes.
    const none = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
    Range.prototype.getClientRects = none;
    Range.prototype.getBoundingClientRect = () => new DOMRect();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    useApp.setState({ config, index: null });
  });

  it("saves a new document once when ⌘↵ arrives twice for one press", async () => {
    // CodeMirror's Mod-Enter and the menu's File → Save both fire; each used to save,
    // and a new document came out as two files.
    window.location.hash = "#editor";
    vi.spyOn(window, "close").mockImplementation(() => undefined);
    const { invoke, emit } = mockVaultApi({
      "draft:load": PARKED,
      "doc:pathPreview": () => "inbox/half-a-thought.md",
      "doc:save": () => new Promise(() => undefined),
    });
    render(<Editor />);
    await screen.findByRole("heading", { name: "Half a thought" });

    act(() => {
      emit("shortcut", "save");
      emit("shortcut", "save");
    });
    await act(() => Promise.resolve());
    expect(docSaves(invoke)).toHaveLength(1);
  });

  describe("the unsaved-changes prompt", () => {
    const openPrompt = async () => {
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      return screen.findByRole("dialog", { name: "Unsaved changes" });
    };
    const saveButton = (dialog: HTMLElement) =>
      within(dialog).getByRole<HTMLButtonElement>("button", { name: /Save & commit/ });

    it("shows a failed save where it can be seen, and stays open", async () => {
      // The error only reached the footer, behind the backdrop: Save looked dead.
      window.location.hash = "#editor";
      const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
      let fail: (e: Error) => void = () => undefined;
      mockVaultApi({
        "draft:load": PARKED,
        "doc:pathPreview": () => "inbox/half-a-thought.md",
        "doc:save": () => new Promise((_, reject) => (fail = reject)),
      });
      render(<Editor />);
      await screen.findByRole("heading", { name: "Half a thought" });
      const dialog = await openPrompt();

      fireEvent.click(saveButton(dialog));
      await waitFor(() => expect(saveButton(dialog).disabled).toBe(true));
      await act(async () => fail(new Error("git is not installed")));

      expect(within(dialog).getByRole("alert").textContent).toBe("git is not installed");
      expect(saveButton(dialog).disabled).toBe(false);
      expect(close).not.toHaveBeenCalled();
    });

    it("says why an emptied document can't be saved", async () => {
      window.location.hash = "#editor";
      vi.spyOn(window, "close").mockImplementation(() => undefined);
      const { invoke } = mockVaultApi({
        "draft:load": { ...PARKED, body: "  \n" },
        "doc:pathPreview": () => "",
      });
      render(<Editor />);
      // Only the metadata changed: dirty, but there is no text to write.
      fireEvent.change(screen.getByLabelText("title"), { target: { value: "Later" } });
      const dialog = await openPrompt();

      fireEvent.click(saveButton(dialog));

      expect((await within(dialog).findByRole("alert")).textContent).toMatch(/nothing to save/);
      expect(docSaves(invoke)).toHaveLength(0);
    });
  });
});
