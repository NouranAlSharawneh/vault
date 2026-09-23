import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Chip } from "@/components/ui";

describe("Chip", () => {
  it("names its remove button after what it removes", async () => {
    // A row of chips that each say "remove" gives no way to tell which one goes.
    const onRemove = vi.fn();
    render(
      <Chip onRemove={onRemove} removeLabel="Remove spec">
        #spec
      </Chip>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove spec" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("falls back to a capitalised Remove when no label is given", () => {
    render(<Chip onRemove={vi.fn()}>#spec</Chip>);
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });
});
