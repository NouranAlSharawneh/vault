import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Toasts } from "@/components/ui";

describe("Toasts", () => {
  it("keeps an empty live region in the document with nothing to say", () => {
    render(<Toasts toasts={[]} announced={null} onDismiss={vi.fn()} />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(region.textContent).toBe("");
  });

  it("writes the newest message into the region and dismisses by id", async () => {
    const onDismiss = vi.fn();
    const toasts = [
      { id: 1, message: "Moved “Spec” to trash" },
      { id: 2, message: "Couldn’t push" },
    ];
    render(<Toasts toasts={toasts} announced={toasts[1]} onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toBe("Couldn’t push");
    expect(screen.getByText("Moved “Spec” to trash")).toBeTruthy();
    await userEvent.click(screen.getAllByRole("button", { name: "dismiss" })[0]);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
