import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { TagInput } from "@/features/editor/components/tag-input/tag-input.component";

describe("TagInput", () => {
  it("adds on Enter (stripping #, lowercasing), autocompletes, removes with Backspace", async () => {
    const onChange = vi.fn();
    render(
      <TagInput value={["spec"]} onChange={onChange} suggestions={["spec", "infra", "prompt"]} />,
    );
    const input = screen.getByLabelText("Tags");
    await userEvent.type(input, "#Infra{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["spec", "infra"]);
    await userEvent.type(input, "pr");
    expect(screen.getByRole("option", { name: "#prompt" })).toBeTruthy();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["spec", "prompt"]);
    await userEvent.type(input, "{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("highlights the first suggestion again when the text changes", async () => {
    // With the third of three suggestions highlighted, typing one more letter left two.
    // The index stayed at 2, past the end, so Enter added the raw half-word instead.
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} suggestions={["prompt", "prod", "pretty"]} />);
    const input = screen.getByLabelText("Tags");
    await userEvent.type(input, "pr{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "#pretty" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    await userEvent.type(input, "o{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["prompt"]);
  });

  it("is a combobox whose active suggestion is announced, not focused", async () => {
    render(<TagInput value={["spec"]} onChange={vi.fn()} suggestions={["infra", "intro"]} />);
    const input = screen.getByRole("combobox", { name: "Tags" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    await userEvent.type(input, "in");
    const list = screen.getByRole("listbox");
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    const [first, second] = screen.getAllByRole("option");
    expect(input.getAttribute("aria-activedescendant")).toBe(first.id);
    await userEvent.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBe(second.id);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "Remove spec" })).toBeTruthy();
  });

  it("ignores duplicates and empty input", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["spec"]} onChange={onChange} suggestions={[]} />);
    await userEvent.type(screen.getByLabelText("Tags"), "spec{Enter}{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
