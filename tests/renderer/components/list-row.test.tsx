import { render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ListRow } from "@/components/ui";

describe("ListRow", () => {
  it.each(["nav", "rail"] as const)("marks the current %s row with aria-current", (kind) => {
    render(
      <>
        <ListRow kind={kind} selected>
          on
        </ListRow>
        <ListRow kind={kind}>off</ListRow>
      </>,
    );
    const on = screen.getByRole("button", { name: "on" });
    // "page": these rows are navigation, and the selected one is where you are.
    expect(on.getAttribute("aria-current")).toBe("page");
    expect(on.hasAttribute("aria-selected")).toBe(false);
    expect(screen.getByRole("button", { name: "off" }).hasAttribute("aria-current")).toBe(false);
  });

  it.each(["menu", "palette"] as const)(
    "is a listbox option out of the Tab order as a %s row",
    (kind) => {
      render(
        <div role="listbox" aria-label="list">
          <ListRow kind={kind} selected>
            on
          </ListRow>
          <ListRow kind={kind}>off</ListRow>
        </div>,
      );
      const on = screen.getByRole("option", { name: "on" });
      expect(on.getAttribute("aria-selected")).toBe("true");
      expect(on.tabIndex).toBe(-1);
      expect(screen.getByRole("option", { name: "off" }).getAttribute("aria-selected")).toBe(
        "false",
      );
    },
  );

  it("is a pressed-or-not choice as an option row", () => {
    render(
      <ListRow kind="option" selected>
        repo
      </ListRow>,
    );
    expect(screen.getByRole("button", { name: "repo", pressed: true })).toBeTruthy();
  });

  it("hovers a row in a fill you can see", () => {
    // paper-2 at 60% over paper measured about 1.03:1 — a hover that wasn't there.
    render(<ListRow kind="option">repo</ListRow>);
    const cls = screen.getByRole("button", { name: "repo" }).className;
    expect(cls).toContain("hover:bg-paper-2");
    expect(cls).not.toMatch(/hover:bg-paper-2\//);
  });

  it("marks the chosen row of a dark dropdown with the cherry bar, not the light pink", () => {
    render(
      <div role="listbox" aria-label="list">
        <ListRow kind="menu" dark selected>
          on
        </ListRow>
      </div>,
    );
    const cls = screen.getByRole("option", { name: "on" }).className;
    expect(cls).toContain("before:bg-cherry-3");
    expect(cls).not.toContain("bg-cherry-tint");
  });
});
