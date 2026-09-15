import { fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DialogShell } from "@/components/ui";

const panel = (onClose = vi.fn()) => {
  const opener = document.createElement("button");
  opener.textContent = "open";
  document.body.append(opener);
  opener.focus();
  const view = render(
    <DialogShell label="Search" onClose={onClose}>
      <button>first</button>
      <button>last</button>
    </DialogShell>,
  );

  return { view, onClose, opener };
};

describe("DialogShell", () => {
  it("takes focus when it opens and gives it back when it closes", () => {
    const { view, opener } = panel();
    expect(document.activeElement).toBe(screen.getByText("first"));
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("closes on Escape from anywhere, not only from the focused control", () => {
    const { onClose, opener } = panel();
    screen.getByText("last").focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    opener.remove();
  });

  it("keeps Tab inside the panel instead of walking into the window behind", () => {
    const { opener } = panel();
    const last = screen.getByText("last");
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("first"));
    opener.remove();
  });

  it("does not steal focus when you click the panel's own padding", () => {
    // This is what went wrong in the palette: clicking a group heading blurred the input
    // and the arrows and Escape stopped working, with no way back but the mouse.
    const { onClose, opener } = panel();
    const first = screen.getByText("first");
    first.focus();
    const dialog = screen.getByRole("dialog");
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(first);
    opener.remove();
  });

  it("closes when the backdrop is clicked", () => {
    const { onClose, opener } = panel();
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalled();
    opener.remove();
  });
});
