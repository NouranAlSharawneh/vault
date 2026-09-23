import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/features/main/components/command-palette/command-palette.component";
import { useApp } from "@/stores/app";
import type { DocMeta } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const doc = (over: Partial<DocMeta>): DocMeta => ({
  title: "t",
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path: "atlas-api/t.md",
  excerpt: "excerpt",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
  ...over,
});
const docs = [
  doc({ path: "a", title: "Rate limiting at the edge", tags: ["spec"] }),
  doc({ path: "b", title: "Weekly sync", tags: ["meeting"] }),
  doc({ path: "c", title: "Starred thing", starred: true, source: "chatgpt" }),
];
const setIndex = () =>
  useApp.setState({
    config: {
      root: "/v",
      remote: "x",
      branch: "main",
      lastProject: null,
      lastSource: "manual",
      hotkey: "Control+Alt+V",
      pushDebounceMs: 3000,
    },
    index: { docs, projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 0 },
    sync: {
      state: "pending",
      ahead: 3,
      behind: 0,
      branch: "main",
      lastPushAt: null,
      lastError: null,
      remote: "x",
      conflicts: 0,
      failure: null,
    },
  });

describe("CommandPalette", () => {
  it("empty query → recent docs + actions incl. 'Push 3 pending docs'", () => {
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.getByText("Push 3 pending docs")).toBeTruthy();
  });

  it("Recent is a glance — at most two, however many docs exist", () => {
    // It used to list eight and swallow the whole panel.
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    expect(screen.getByText("Recent")).toBeTruthy();
    // Titles also appear in the preview pane, so count rather than expect one node.
    expect(screen.getAllByText("Rate limiting at the edge").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Weekly sync").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Starred thing")).toHaveLength(0);
  });

  it("a filtered search still shows the full list, not the Recent glance", () => {
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "source:chatgpt" } });
    expect(screen.getByText("Matching")).toBeTruthy();
    expect(screen.getAllByText("Starred thing").length).toBeGreaterThan(0);
  });

  it("text query groups title hits and in-text hits, Enter opens the first", async () => {
    const onOpen = vi.fn();
    mockVaultApi({
      "search:query": () => [
        { path: "b", score: 2, snippet: "…we rate-limit inside…" },
        { path: "a", score: 3, snippet: null },
      ],
    });
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={onOpen} />);
    await userEvent.type(screen.getByLabelText("search"), "rate limit");
    await waitFor(() => expect(screen.getByText("Documents")).toBeTruthy());
    expect(screen.getByText("In text")).toBeTruthy();
    expect(screen.getByText("…we rate-limit inside…")).toBeTruthy();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith("a");
  });

  it("structured filters without text narrow the list", () => {
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    const input = screen.getByLabelText("search");

    // fireEvent-style typing of operators
    return userEvent.type(input, "is:starred source:chatgpt").then(() => {
      expect(screen.getByText("Matching")).toBeTruthy();
      expect(screen.getAllByText("Starred thing").length).toBeGreaterThan(0);
      expect(screen.queryByText("Weekly sync")).toBeNull();
    });
  });

  it("is a combobox over a listbox of grouped options, focus staying in the input", async () => {
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    const input = screen.getByRole("combobox", { name: "search" });
    const list = screen.getByRole("listbox", { name: "Results" });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    expect(screen.getByRole("group", { name: "Recent" })).toBeTruthy();
    const options = screen.getAllByRole("option");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(document.activeElement).toBe(input);
  });

  it("Escape closes; actions run their IPC", async () => {
    const onClose = vi.fn();
    const { invoke } = mockVaultApi({
      "vault:rescan": { docs: [], projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 0 },
    });
    setIndex();
    render(<CommandPalette onClose={onClose} onOpenDoc={() => undefined} />);
    await userEvent.click(screen.getByText("Rescan vault folder"));
    expect(invoke).toHaveBeenCalledWith("vault:rescan");
    expect(onClose).toHaveBeenCalled();
  });

  // The input and a window listener both handle the keys; React's root delegation meant
  // one keypress reached both, so every key used to act twice.
  const selectedRow = (container: HTMLElement) =>
    container.querySelector('[aria-selected="true"]')?.textContent ?? "";

  it("Enter runs the chosen action exactly once", async () => {
    const onTrash = vi.fn();
    const onClose = vi.fn();
    mockVaultApi({ "search:query": () => [] });
    setIndex();
    render(<CommandPalette onClose={onClose} onOpenDoc={() => undefined} onTrashDoc={onTrash} />);
    await userEvent.type(screen.getByLabelText("search"), "trash");
    await userEvent.keyboard("{Enter}");
    expect(onTrash).toHaveBeenCalledTimes(1);
  });

  it("Enter opens the highlighted doc exactly once", async () => {
    const onOpen = vi.fn();
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={onOpen} />);
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("a");
  });

  it("ArrowDown moves the highlight exactly one row", async () => {
    mockVaultApi();
    setIndex();
    const { container } = render(
      <CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />,
    );
    expect(selectedRow(container)).toContain("Rate limiting at the edge");
    await userEvent.keyboard("{ArrowDown}");
    expect(selectedRow(container)).toContain("Weekly sync");
    await userEvent.keyboard("{ArrowUp}");
    expect(selectedRow(container)).toContain("Rate limiting at the edge");
  });

  it("keys still work, once each, after clicking the preview blurs the input", async () => {
    const onOpen = vi.fn();
    mockVaultApi();
    setIndex();
    const { container } = render(<CommandPalette onClose={() => undefined} onOpenDoc={onOpen} />);
    await userEvent.click(screen.getByText("excerpt"));
    // jsdom keeps focus on a click into plain text; a browser drops it to the body.
    act(() => screen.getByLabelText("search").blur());
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard("{ArrowDown}");
    expect(selectedRow(container)).toContain("Weekly sync");
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("b");
  });

  it("the trash action names the doc it will trash", () => {
    mockVaultApi();
    setIndex();
    render(
      <CommandPalette
        onClose={() => undefined}
        onOpenDoc={() => undefined}
        onTrashDoc={() => undefined}
        trashTitle="Weekly sync"
      />,
    );
    expect(screen.getByText("Move “Weekly sync” to trash")).toBeTruthy();
    expect(screen.queryByText("Move document to trash")).toBeNull();
  });

  it.each(["trash", "move document"])(
    "typing “%s” still finds the named trash action",
    async (q) => {
      mockVaultApi({ "search:query": () => [] });
      setIndex();
      render(
        <CommandPalette
          onClose={() => undefined}
          onOpenDoc={() => undefined}
          onTrashDoc={() => undefined}
          trashTitle="Weekly sync"
        />,
      );
      await userEvent.type(screen.getByLabelText("search"), q);
      expect(screen.getByText("Move “Weekly sync” to trash")).toBeTruthy();
    },
  );

  it("with no doc open there is no trash action at all", () => {
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    expect(screen.queryByText(/to trash/)).toBeNull();
  });

  it("Escape still closes the palette", async () => {
    const onClose = vi.fn();
    mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={onClose} onOpenDoc={() => undefined} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
