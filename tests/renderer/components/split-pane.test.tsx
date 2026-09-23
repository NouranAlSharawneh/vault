import { fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SplitPane } from "@/components/ui";

describe("SplitPane", () => {
  it("drags the divider within bounds and persists the ratio", () => {
    localStorage.removeItem("t-split");
    const { container } = render(
      <SplitPane
        left={<div>L</div>}
        right={<div>R</div>}
        storageKey="t-split"
        minRatio={0.2}
        maxRatio={0.8}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    root.getBoundingClientRect = () => ({
      left: 0,
      width: 1000,
      top: 0,
      height: 0,
      right: 1000,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const sep = screen.getByRole("separator");
    fireEvent.pointerDown(sep, { clientX: 500 });
    fireEvent.pointerMove(window, { clientX: 300 });
    fireEvent.pointerUp(window);
    expect(sep.getAttribute("aria-valuenow")).toBe("30");
    expect(localStorage.getItem("t-split")).toBe("0.3");
    fireEvent.pointerDown(sep, { clientX: 300 });
    fireEvent.pointerMove(window, { clientX: 950 });
    fireEvent.pointerUp(window);
    expect(sep.getAttribute("aria-valuenow")).toBe("80");
    fireEvent.doubleClick(sep);
    expect(sep.getAttribute("aria-valuenow")).toBe("50");
  });
});
