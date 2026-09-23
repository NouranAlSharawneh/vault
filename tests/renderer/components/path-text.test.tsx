// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PathText } from "@/components/ui";

describe("PathText", () => {
  const path = "/Users/nunu/Documents/a-very-long-folder-name/vault";

  it("keeps the whole path on hover", () => {
    render(<PathText path={path} />);
    expect(screen.getByTitle(path).textContent).toBe(path);
  });

  it("cuts from the start, so the folder name is what stays visible", () => {
    render(<PathText path={path} />);
    const outer = screen.getByTitle(path);
    expect(outer.getAttribute("dir")).toBe("rtl");
    expect(outer.className).toContain("truncate");
    expect(outer.className).toContain("min-w-0");
    // The characters themselves still read left to right.
    expect(outer.firstElementChild?.getAttribute("dir")).toBe("ltr");
  });
});
