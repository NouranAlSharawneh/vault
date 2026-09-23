import { render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Dot } from "@/components/ui";

describe("Dot", () => {
  it("keeps its label: a labelled dot is an image with that name", () => {
    // The list's unpushed dot passed aria-label="not pushed yet" and it was dropped on
    // the floor, so the one place that state is shown said nothing to a screen reader.
    render(<Dot tone="bg-warn" size={6} aria-label="not pushed yet" />);
    const dot = screen.getByRole("img", { name: "not pushed yet" });
    expect(dot.getAttribute("aria-hidden")).toBeNull();
  });

  it("hides an unlabelled dot, which is decoration beside a word", () => {
    const { container } = render(<Dot color="#b4232f" />);
    const dot = container.firstElementChild!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(dot.getAttribute("role")).toBeNull();
  });
});
