// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useRef } from "react";
import { act, render } from "@testing-library/react";
import { MERMAID_ZOOM_MAX, MERMAID_ZOOM_MIN } from "@/constants";
import { useDiagramZoom } from "@/components/markdown/mermaid-block/hooks/use-diagram-zoom.hook";
import { relaxMermaidWidth, svgIntrinsicWidth } from "@/helpers";

const SVG = '<svg id="d" width="800" viewBox="0 0 800 400" style="max-width: 800px;"></svg>';

/**
 * jsdom has no layout and no ResizeObserver, so stand in a pane of a known width and
 * mount a real element for the hook's ref — the measurement is the thing under test.
 */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

function withPane(width: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    value: width,
    configurable: true,
  });
  const captured: { current: ReturnType<typeof useDiagramZoom> } = { current: null! };
  function Harness() {
    const paneRef = useRef<HTMLDivElement>(null);
    captured.current = useDiagramZoom(SVG, paneRef);
    return <div ref={paneRef} />;
  }
  render(<Harness />);
  return captured;
}

describe("svgIntrinsicWidth", () => {
  it("reads the width mermaid actually asks for", () => {
    expect(svgIntrinsicWidth(SVG)).toBe(800);
    expect(svgIntrinsicWidth('<svg width="640" viewBox="0 0 640 480"></svg>')).toBe(640);
    expect(svgIntrinsicWidth('<svg viewBox="0 0 512 200"></svg>')).toBe(512);
    expect(svgIntrinsicWidth(null)).toBeNull();
  });
});

describe("useDiagramZoom", () => {
  it("starts at 100% and steps up and down", () => {
    const result = withPane(1000);
    expect(result.current.percent).toBe(100);
    expect(result.current.isDefault).toBe(true);
    act(() => result.current.zoomIn());
    expect(result.current.percent).toBe(125);
    act(() => result.current.zoomOut());
    expect(result.current.percent).toBe(100);
  });

  it("clamps at both ends rather than running away", () => {
    const result = withPane(1000);
    for (let i = 0; i < 40; i++) act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(MERMAID_ZOOM_MAX);
    expect(result.current.canZoomIn).toBe(false);
    for (let i = 0; i < 60; i++) act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(MERMAID_ZOOM_MIN);
    expect(result.current.canZoomOut).toBe(false);
  });

  it("resets straight back to 100%", () => {
    const result = withPane(1000);
    act(() => result.current.zoomIn());
    act(() => result.current.reset());
    expect(result.current.percent).toBe(100);
  });

  it("hands out a real pixel width that actually grows with the zoom", () => {
    // The whole point: a CSS transform or `zoom` cancels against the SVG's own
    // max-width, so the number the button shows has to reach the DOM as a width.
    const z = withPane(1000);
    expect(z.current.width).toBe(800);
    act(() => z.current.zoomIn());
    expect(z.current.width).toBe(1000);
    act(() => z.current.zoomIn());
    expect(z.current.width).toBe(1200);
  });

  it("fits a diagram wider than the pane before scaling from there", () => {
    const z = withPane(432); // 432 - 32 padding = 400 usable
    expect(z.current.width).toBe(400);
    act(() => z.current.zoomIn());
    expect(z.current.width).toBe(500);
  });
});

describe("relaxMermaidWidth", () => {
  it("lifts the inline cap that made zoom a no-op", () => {
    const out = relaxMermaidWidth(
      '<svg width="100%" style="max-width: 302.40625px;" viewBox="0 0 302.40625 70"></svg>',
    );
    expect(out).toContain("max-width:100%");
    expect(out).not.toContain("302.40625px");
    // The natural size is still readable, from the viewBox.
    expect(svgIntrinsicWidth(out)).toBe(302.40625);
  });

  it("leaves a diagram without an inline cap alone", () => {
    const svg = '<svg viewBox="0 0 512 200"></svg>';
    expect(relaxMermaidWidth(svg)).toBe(svg);
  });
});
