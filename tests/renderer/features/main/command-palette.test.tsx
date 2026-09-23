import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    const { invoke } = mockVaultApi();
    setIndex();
    render(<CommandPalette onClose={onClose} onOpenDoc={() => undefined} />);
    await userEvent.click(screen.getByText("Rescan vault folder"));
    expect(invoke).toHaveBeenCalledWith("vault:rescan");
    expect(onClose).toHaveBeenCalled();
  });
});
