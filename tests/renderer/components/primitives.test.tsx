// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, DialogHeader, Empty, Kbd, Segmented } from "@/components/ui";

describe("Segmented", () => {
  const options = [
    { value: "preview", label: "Preview" },
    { value: "markdown", label: "Markdown" },
  ] as const;

  it("is a named group of toggles that says which one is pressed", () => {
    const onChange = vi.fn();
    render(<Segmented label="Reader view" options={options} value="preview" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Reader view" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview", pressed: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Markdown", pressed: false }));
    expect(onChange).toHaveBeenCalledWith("markdown");
  });
});

describe("Empty", () => {
  it("is an alert with a warning mark when something failed", () => {
    render(<Empty tone="error" title="Couldn’t open this document" hint="EACCES" />);
    expect(screen.getByRole("alert").textContent).toContain("Couldn’t open this document");
  });

  it("is quiet when there is simply nothing", () => {
    render(<Empty title="Nothing here yet" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Button", () => {
  it("is square when it only holds an icon", () => {
    render(
      <>
        <Button size="icon" aria-label="star" />
        <Button size="icon-sm" aria-label="zoom in" />
      </>,
    );
    expect(screen.getByRole("button", { name: "star" }).className).toMatch(/\bw-7\b.*\bpx-0\b/);
    expect(screen.getByRole("button", { name: "zoom in" }).className).toMatch(/\bh-6 w-6\b/);
  });
});

describe("DialogHeader", () => {
  it("names the dialog and closes it", () => {
    const onClose = vi.fn();
    render(<DialogHeader title="History" closeLabel="close history" onClose={onClose} />);
    expect(screen.getByText("History")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close history" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Kbd", () => {
  const css = readFileSync(join(process.cwd(), "src/renderer/styles/global.css"), "utf8");

  it("draws dark when told to, not only inside a dark surface", () => {
    // <Kbd dark> puts the class on the kbd itself, which `.dark kbd` never matched.
    const { container } = render(<Kbd dark>esc</Kbd>);
    expect(container.querySelector("kbd.dark")).toBeTruthy();
    expect(css).toMatch(/\.dark kbd,\s*kbd\.dark \{/);
  });

  it("takes a filled button's colour on one", () => {
    const { container } = render(<Kbd onFill>⌘↵</Kbd>);
    expect(container.querySelector("kbd.on-fill")).toBeTruthy();
    expect(css).toMatch(/kbd\.on-fill \{/);
  });
});
