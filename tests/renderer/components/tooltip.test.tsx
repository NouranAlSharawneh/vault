// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Button, Tooltip } from "@/components/ui";

const rest = (el: HTMLElement) => {
  fireEvent.pointerEnter(el);
  act(() => void vi.advanceTimersByTime(400));
};

describe("Tooltip", () => {
  it("appears only after the pointer rests, and leaves when it does", () => {
    vi.useFakeTimers();
    render(
      <Tooltip label="History" keys="⌘Y">
        <button>h</button>
      </Tooltip>,
    );
    const host = screen.getByText("h").parentElement!;
    fireEvent.pointerEnter(host);
    // A pointer crossing a toolbar must not trail labels behind it.
    act(() => void vi.advanceTimersByTime(80));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.getByRole("tooltip").textContent).toBe("History⌘Y");
    fireEvent.pointerLeave(host);
    expect(screen.queryByRole("tooltip")).toBeNull();
    vi.useRealTimers();
  });

  it("does not linger over a button that was just clicked", () => {
    vi.useFakeTimers();
    render(
      <Tooltip label="Star">
        <button>s</button>
      </Tooltip>,
    );
    const host = screen.getByText("s").parentElement!;
    rest(host);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.pointerDown(host);
    expect(screen.queryByRole("tooltip")).toBeNull();
    vi.useRealTimers();
  });

  it("slides back in rather than hanging off the window edge", () => {
    vi.useFakeTimers();
    render(
      <Tooltip label="Move to trash" keys="⌘⌫">
        <button>t</button>
      </Tooltip>,
    );
    const host = screen.getByText("t").parentElement!;
    // jsdom lays nothing out, so stand in for a label that overruns the right edge.
    const overrun = 24;
    const real = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () =>
      ({ right: window.innerWidth - 8 + overrun, left: 100 }) as DOMRect;
    try {
      rest(host);
      expect(screen.getByRole("tooltip").style.marginLeft).toBe(`-${overrun}px`);
    } finally {
      Element.prototype.getBoundingClientRect = real;
    }
    vi.useRealTimers();
  });

  it("is what a Button's `tooltip` prop draws, without touching the button itself", () => {
    vi.useFakeTimers();
    render(
      <Button tooltip="Edit" aria-label="edit">
        <span>e</span>
      </Button>,
    );
    const button = screen.getByLabelText("edit");
    // No native title alongside it: two labels over one button is one too many.
    expect(button.getAttribute("title")).toBeNull();
    rest(button.parentElement!);
    expect(screen.getByRole("tooltip").textContent).toBe("Edit");
    vi.useRealTimers();
  });
});
