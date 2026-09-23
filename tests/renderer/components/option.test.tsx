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

  it("leaves keys typed into a field inside it alone", async () => {
    const onClick = vi.fn();
    render(
      <Option selected onClick={onClick}>
        <input aria-label="name" />
      </Option>,
    );
    await userEvent.type(screen.getByLabelText("name"), "my vault{Enter}");
    expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("my vault");
    expect(onClick).toHaveBeenCalledTimes(1); // the click that focused the field, not the keys
  });
});
