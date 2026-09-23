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
    const input = screen.getByLabelText("tags");
    await userEvent.type(input, "#Infra{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["spec", "infra"]);
    await userEvent.type(input, "pr");
    expect(screen.getByRole("button", { name: "#prompt" })).toBeTruthy();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["spec", "prompt"]);
    await userEvent.type(input, "{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("ignores duplicates and empty input", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["spec"]} onChange={onChange} suggestions={[]} />);
    await userEvent.type(screen.getByLabelText("tags"), "spec{Enter}{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
