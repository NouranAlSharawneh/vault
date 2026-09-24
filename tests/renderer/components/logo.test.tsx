import { act, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo, Wordmark } from "@/components/ui";
import { LOGO_16, LOGO_20 } from "@/data/logo.data";
import { LOGO_HOP_FRAME_MS, LOGO_HOP_LOOPS } from "@shared/constants";

const viewBox = (rows: readonly string[]) => `0 0 ${rows[0].length} ${rows.length}`;

afterEach(() => vi.useRealTimers());

describe("Logo", () => {
  it("draws the 16×16 cherry below 32px and the 20×20 one from 32px", () => {
    const { rerender } = render(<Logo size={14} />);
    expect(screen.getByRole("img", { name: "Marasca" }).getAttribute("viewBox")).toBe(
      viewBox(LOGO_16.still),
    );
    rerender(<Logo size={32} />);
    expect(screen.getByRole("img", { name: "Marasca" }).getAttribute("viewBox")).toBe(
      viewBox(LOGO_20.still),
    );
  });

  it("uses the cherry colours in brand tone and currentColor in mono", () => {
    const { container, rerender } = render(<Logo />);
    const fills = () =>
      new Set([...container.querySelectorAll("rect")].map((r) => r.getAttribute("class")));
    expect(fills()).toEqual(new Set(["fill-cherry", "fill-cherry-3", "fill-cherry-2"]));
    rerender(<Logo tone="mono" />);
    expect(fills()).toEqual(new Set(["fill-current"]));
  });

  it("hops through its frames, then rests without moving the mark", () => {
    vi.useFakeTimers();
    const { hop } = LOGO_20;
    render(<Logo size={72} bounce />);
    const svg = screen.getByRole("img", { name: "Marasca" });
    expect(svg.getAttribute("viewBox")).toBe(viewBox(hop!.rest));
    const first = svg.innerHTML;
    act(() => vi.advanceTimersByTime(LOGO_HOP_FRAME_MS));
    expect(svg.innerHTML).not.toBe(first);
    act(() => vi.advanceTimersByTime(LOGO_HOP_FRAME_MS * hop!.frames.length * LOGO_HOP_LOOPS));
    const settled = svg.innerHTML;
    act(() => vi.advanceTimersByTime(LOGO_HOP_FRAME_MS * 5));
    expect(svg.innerHTML).toBe(settled);
    expect(svg.getAttribute("viewBox")).toBe(viewBox(hop!.rest));
  });
});

describe("Wordmark", () => {
  it("is an image named Marasca that keeps the font's 41×5 proportions", () => {
    render(<Wordmark height={10} />);
    const svg = screen.getByRole("img", { name: "Marasca" });
    expect(svg.getAttribute("height")).toBe("10");
    expect(svg.getAttribute("width")).toBe("82");
  });
});
