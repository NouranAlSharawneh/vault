import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type KeyboardEvent } from "react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useCombobox } from "@/features/editor/components/project-combobox/hooks/use-combobox.hook";
import { ProjectCombobox } from "@/features/editor/components/project-combobox/project-combobox.component";

const PROJECTS = ["Atlas API", "Atlas Web", "Onboarding v2", "Research log"];
const key = (k: string) =>
  ({ key: k, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLInputElement>;

describe("useCombobox", () => {
  it("puts the highlight back on the first match when the query changes", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ v }) => useCombobox(v, onChange, PROJECTS), {
      initialProps: { v: "" },
    });
    act(() => result.current.setOpen(true));
    act(() => result.current.onKeyDown(key("ArrowDown")));
    act(() => result.current.onKeyDown(key("ArrowDown")));
    act(() => result.current.onKeyDown(key("ArrowDown")));
    expect(result.current.cursor).toBe(3);
    // Four matches become one. The cursor used to stay at 3, so Enter did nothing.
    rerender({ v: "research" });
    expect(result.current.cursor).toBe(0);
    act(() => result.current.onKeyDown(key("Enter")));
    expect(onChange).toHaveBeenLastCalledWith("Research log");
  });

  it("clamps a highlight left past the end when the options shrink", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ o }) => useCombobox("", onChange, o), {
      initialProps: { o: PROJECTS },
    });
    act(() => result.current.setOpen(true));
    act(() => result.current.onKeyDown(key("ArrowUp")));
    expect(result.current.cursor).toBe(3);
    rerender({ o: PROJECTS.slice(0, 2) });
    expect(result.current.cursor).toBe(1);
    act(() => result.current.onKeyDown(key("Enter")));
    expect(onChange).toHaveBeenLastCalledWith("Atlas Web");
  });
});

function Harness() {
  const [value, setValue] = useState("");

  return <ProjectCombobox value={value} onChange={setValue} projects={PROJECTS} />;
}

describe("ProjectCombobox", () => {
  it("is a combobox pointing at its listbox, with focus staying in the input", async () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Project" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(input);
    await userEvent.type(input, "atlas");
    const list = screen.getByRole("listbox", { name: "Projects" });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent?.trim())).toEqual(["Atlas API", "Atlas Web"]);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    await userEvent.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(input);
  });
});
