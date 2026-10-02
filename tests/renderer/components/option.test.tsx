import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Option } from "@/components/ui";

describe("Option — keyboard", () => {
  it("is a radio that reports whether it is checked", () => {
    render(
      <Option selected onClick={() => undefined}>
        New repo
      </Option>,
    );
    expect(screen.getByRole("radio", { name: "New repo" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("can be reached with Tab and chosen with Enter or Space", async () => {
    const onClick = vi.fn();
    render(
      <Option selected={false} onClick={onClick}>
        New repo
      </Option>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio"));
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("keeps its field outside the radio, where keys typed into it are its own", async () => {
    // A radio's children are presentational: a field nested in one could vanish for a
    // screen reader, and its Enter selected the option.
    const onClick = vi.fn();
    render(
      <Option selected onClick={onClick} detail={<input aria-label="name" />}>
        New repo
      </Option>,
    );
    const field = screen.getByLabelText("name");
    expect(screen.getByRole("radio").contains(field)).toBe(false);
    await userEvent.type(field, "my vault{Enter}");
    expect((field as HTMLInputElement).value).toBe("my vault");
    expect(onClick).not.toHaveBeenCalled();
  });
});
