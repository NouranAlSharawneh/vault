import { act, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo, Wordmark } from "@/components/ui";
import { LOGO_16, LOGO_20 } from "@/data/logo.data";
import { LOGO_HOP_FRAME_MS } from "@shared/constants";

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

  it("loops continuously: every frame, in order, with no pause, and never settles", () => {
    vi.useFakeTimers();
    const { hop } = LOGO_20;
    const n = hop!.frames.length;
    render(<Logo size={72} bounce />);
    const svg = screen.getByRole("img", { name: "Marasca" });
    const seen: string[] = [svg.innerHTML];
    // Four full cycles, one frame at a time.
    for (let i = 1; i <= n * 4; i++) {
      act(() => vi.advanceTimersByTime(LOGO_HOP_FRAME_MS));
      seen.push(svg.innerHTML);
    }
    // Frame i is always the same drawing as frame i + n: a clean loop, no rest inserted.
    for (let i = 0; i + n < seen.length; i++) expect(seen[i + n], `frame ${i}`).toBe(seen[i]);
    // And it keeps moving: no stretch of a whole cycle where the mark stands still.
    for (let i = 0; i + n <= seen.length; i++)
      expect(new Set(seen.slice(i, i + n)).size, `window at ${i}`).toBeGreaterThan(1);
    expect(svg.getAttribute("viewBox")).toBe(viewBox(hop!.rest));
  });

  it("stays still under reduced motion", () => {
    vi.useFakeTimers();
    const mm = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    render(<Logo size={72} bounce />);
    const svg = screen.getByRole("img", { name: "Marasca" });
    const still = svg.innerHTML;
    act(() => vi.advanceTimersByTime(LOGO_HOP_FRAME_MS * 40));
    expect(svg.innerHTML).toBe(still);
    mm.mockRestore();
  });

  it("stops its timer when it unmounts", () => {
    vi.useFakeTimers();
    const { unmount } = render(<Logo size={72} bounce />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
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
