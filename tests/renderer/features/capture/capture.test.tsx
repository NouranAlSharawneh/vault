// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Capture } from "@/features/capture/capture.component";
import { useApp } from "@/stores/app";
import type { ClipboardCapture } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

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
    const { emit } = mockMarascaApi({
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
    const { emit, invoke } = mockMarascaApi({
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
    mockMarascaApi({ "capture:readClipboard": () => clip, "doc:pathPreview": () => "" });
    render(<Capture />);
    const preview = await screen.findByLabelText("Clipboard preview");
    expect(preview.tabIndex).toBe(0);
  });

  it("shows nothing loud while the clipboard is still being read", () => {
    mockMarascaApi({
      "capture:readClipboard": () => new Promise(() => undefined),
      "doc:pathPreview": () => "",
    });
    render(<Capture />);
    expect(screen.getByRole("status", { name: "Reading the clipboard" })).toBeTruthy();
    expect(screen.queryByText("Clipboard is empty")).toBeNull();
  });

  it("keeps the bar to save and Actions, with every other action in the ⌘K menu", async () => {
    mockMarascaApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "_inbox/pasted-spec.md",
    });
    render(<Capture />);
    await screen.findByLabelText("Clipboard preview");
    // The caption line for the third action is gone; where the doc goes is said in words.
    expect(screen.queryByText("saves and opens it in Marasca")).toBeNull();
    await screen.findByText("pasted-spec.md");
    expect(screen.getByText("Inbox")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();

    act(() => screen.getByRole("button", { name: /Actions/ }).click());
    const menu = screen.getByRole("menu", { name: "Actions" });
    const items = within(menu)
      .getAllByRole("menuitem")
      .map((i) => i.textContent);
    expect(items).toEqual([
      expect.stringMatching(/^Save/),
      expect.stringMatching(/^Save and open in Marasca/),
      expect.stringMatching(/^Open in editor/),
      expect.stringMatching(/^Discard/),
    ]);
  });

  it("closes the menu on Escape without discarding the capture", async () => {
    const { invoke } = mockMarascaApi({
      "capture:readClipboard": () => clip,
      "doc:pathPreview": () => "",
    });
    render(<Capture />);
    await screen.findByLabelText("Clipboard preview");
    const sheet = screen.getByRole("dialog");
    act(() => {
      sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    });
    const menu = screen.getByRole("menu");
    act(() => {
      menu.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(invoke).not.toHaveBeenCalledWith("capture:hide");
  });
});

describe("capture sheet — title, formatting and tags", () => {
  beforeEach(() => useApp.setState({ config: null, index: null }));

  it("names the document in an editable title, prefilled from the clip", async () => {
    mockMarascaApi({ "capture:readClipboard": () => clip, "doc:pathPreview": () => "" });
    render(<Capture />);
    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(title.value).toBe("Pasted spec");
    fireEvent.change(title, { target: { value: "Spec, as agreed" } });
    expect(title.value).toBe("Spec, as agreed");
  });

  it("shows a copied page converted, and the text as copied a click away", async () => {
    const page: ClipboardCapture = {
      ...clip,
      text: "Setup\nInstall",
      looksLikeMarkdown: false,
      detectedTitle: "Setup",
      converted: "## Setup\n\n- Install",
    };
    mockMarascaApi({ "capture:readClipboard": () => page, "doc:pathPreview": () => "" });
    render(<Capture />);
    const preview = await screen.findByLabelText("Clipboard preview");
    expect(preview.textContent).toContain("## Setup");
    fireEvent.click(screen.getByRole("button", { name: "As copied", pressed: false }));
    expect(preview.textContent).not.toContain("## Setup");
    expect(screen.getByRole("button", { name: "As copied", pressed: true })).toBeTruthy();
  });

  it("offers the vault's tags the clip is about, one click each", async () => {
    useApp.setState({
      index: {
        docs: [],
        projects: [],
        tags: [
          { tag: "infra", count: 3 },
          { tag: "unrelated", count: 9 },
        ],
        orphans: 0,
        headSha: null,
        scannedAt: 0,
      },
    });
    mockMarascaApi({
      "capture:readClipboard": () => ({ ...clip, text: "# Infra budget\n\nNotes" }),
      "doc:pathPreview": () => "",
    });
    render(<Capture />);
    const group = await screen.findByRole("group", { name: "Suggested tags" });
    fireEvent.click(within(group).getByRole("button", { name: /#infra/ }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Suggested tags" })).toBeNull());
    expect(screen.getByRole("button", { name: "Remove infra" })).toBeTruthy();
  });
});
