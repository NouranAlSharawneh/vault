// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandPalette } from "@/features/main/components/command-palette/command-palette.component";
import { useApp } from "@/stores/app";
import { mockVaultApi } from "../../helpers/mock-vault-api";
import type { SyncStatus } from "@shared/types";

const sync = (patch: Partial<SyncStatus> = {}): SyncStatus => ({
  state: "synced",
  ahead: 0,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: null,
  remote: "nunu/vault",
  conflicts: 0,
  ...patch,
});

beforeEach(() => {
  mockVaultApi();
  useApp.setState({
    index: { docs: [], projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 0 },
    sync: sync(),
  } as never);
});

describe("palette actions", () => {
  it("offers a pull, which nothing in the app could ask for before", () => {
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} />);
    expect(screen.getByText("Pull from GitHub")).toBeTruthy();
  });

  it("does not claim the capture hotkey opens the editor", () => {
    // The action opens the editor; ⌃⌥V opens the capture sheet. Advertising the hotkey
    // against it said two different things did the same thing.
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} />);
    const row = screen.getByText("New doc from clipboard").closest("button");
    expect(row?.textContent).toBe("New doc from clipboard");
  });

  it("offers the conflict review only when something is waiting", () => {
    const { unmount } = render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} />);
    expect(screen.queryByText("Review versions of a document")).toBeNull();
    unmount();
    useApp.setState({ sync: sync({ conflicts: 2 }) } as never);
    render(
      <CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} onReviewConflicts={vi.fn()} />,
    );
    expect(screen.getByText("Review versions of a document")).toBeTruthy();
  });
});
