// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Capture } from "@/features/capture/capture.component";
import { useApp } from "@/stores/app";
import type { ClipboardCapture } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

// jsdom has no ResizeObserver; the sheet only uses it to fit its window to the content.
class NoopResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

const clip: ClipboardCapture = {
  text: "# Pasted spec\n\nbody",
  words: 3,
  lines: 3,
  looksLikeMarkdown: true,
  detectedSource: "chatgpt",
  detectedTitle: "Pasted spec",
};

describe("capture sheet", () => {
  beforeEach(() => useApp.setState({ config: null, index: null }));

  it("is announced as a dialog and takes focus itself on show, not a field", async () => {
    const { emit } = mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
    });
    render(<Capture />);
    const sheet = screen.getByRole("dialog", { name: "Capture from clipboard" });
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    act(() => emit("capture:shown", clip));
    expect(document.activeElement).toBe(sheet);
    await screen.findByLabelText("Clipboard preview");
    // Filling the form in must not pull focus into an input.
    expect(document.activeElement).toBe(sheet);
  });

  it("⌘↵ still saves with focus on the sheet", async () => {
    const { emit, invoke } = mockVaultApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
      "doc:save": () => ({ path: "x.md", committed: true, meta: {} }),
    });
    render(<Capture />);
    act(() => emit("capture:shown", clip));
    await screen.findByLabelText("Clipboard preview");
    const sheet = screen.getByRole("dialog");
    act(() => {
      sheet.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("doc:save", expect.anything()));
  });

  it("lets the clipboard preview take keyboard focus so a long clip can scroll", async () => {
    mockVaultApi({ "capture:readClipboard": () => clip, "doc:pathPreview": () => "" });
    render(<Capture />);
    const preview = await screen.findByLabelText("Clipboard preview");
    expect(preview.tabIndex).toBe(0);
  });

  it("shows nothing loud while the clipboard is still being read", () => {
    mockVaultApi({
      "capture:readClipboard": () => new Promise(() => undefined),
      "doc:pathPreview": () => "",
    });
    render(<Capture />);
    expect(screen.getByRole("status", { name: "Reading the clipboard" })).toBeTruthy();
    expect(screen.queryByText("Clipboard is empty")).toBeNull();
  });

  it("shows both save chords", async () => {
    mockVaultApi({ "capture:readClipboard": () => clip, "doc:pathPreview": () => "" });
    render(<Capture />);
    await screen.findByLabelText("Clipboard preview");
    expect(screen.getByText("saves and opens it in Vault")).toBeTruthy();
  });
});
