import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/features/main/components/command-palette/command-palette.component";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { ConflictPair, PullResult, SyncStatus, VaultConfig } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const sync = (patch: Partial<SyncStatus> = {}): SyncStatus => ({
  state: "synced",
  ahead: 0,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: null,
  remote: "nunu/vault",
  conflicts: 0,
  failure: null,
  ...patch,
});

const config: VaultConfig = {
  root: "/v",
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};
const EMPTY_INDEX = { docs: [], projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 0 };

beforeEach(() => {
  mockVaultApi();
  useToast.getState().dismiss();
  useApp.setState({ config, index: EMPTY_INDEX, sync: sync() } as never);
});

const pullAnswering = async (result: Partial<PullResult>, onReviewConflicts = vi.fn()) => {
  const { invoke } = mockVaultApi({
    "sync:pull": { conflicts: [], pulled: 0, failure: null, ...result },
  });
  render(
    <CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} onReviewConflicts={onReviewConflicts} />,
  );
  await userEvent.click(screen.getByText("Pull from GitHub"));
  expect(invoke).toHaveBeenCalledWith("sync:pull");
  await vi.waitFor(() => expect(useToast.getState().toasts.length).toBeGreaterThan(0));

  return useToast.getState().toasts.at(-1);
};

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
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} onReviewConflicts={vi.fn()} />);
    expect(screen.getByText("Review versions of a document")).toBeTruthy();
  });

  it("offers neither a pull nor a push to a vault with no GitHub repo", () => {
    // A local vault counted every commit as unpushed and offered to push them nowhere.
    useApp.setState({ config: { ...config, remote: null }, sync: sync({ ahead: 12 }) } as never);
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} />);
    expect(screen.queryByText("Pull from GitHub")).toBeNull();
    expect(screen.queryByText(/Push .* pending/)).toBeNull();
  });

  it("says a pull found nothing new", async () => {
    expect((await pullAnswering({ pulled: 0 }))?.message).toBe("Up to date");
  });

  it("says how much a pull brought down", async () => {
    expect((await pullAnswering({ pulled: 3 }))?.message).toBe("Pulled 3 changes from GitHub");
  });

  it("points at what a pull left to review, and opens it", async () => {
    const onReview = vi.fn();
    const pair = {} as ConflictPair;
    const toast = await pullAnswering({ pulled: 1, conflicts: [pair] }, onReview);
    expect(toast?.message).toBe("Pulled 1 change from GitHub · 1 document to review");
    expect(toast?.action?.label).toBe("Review");
    void toast?.action?.run();
    expect(onReview).toHaveBeenCalled();
  });

  it("says a pull failed instead of passing it off as done", async () => {
    const toast = await pullAnswering({ failure: "offline" });
    expect(toast?.message).toBe("Couldn’t reach GitHub — pull again once you’re online");
  });

  it("says what a rescan found", async () => {
    mockVaultApi({
      "vault:rescan": { ...EMPTY_INDEX, docs: [{}, {}] },
    });
    render(<CommandPalette onClose={vi.fn()} onOpenDoc={vi.fn()} />);
    await userEvent.click(screen.getByText("Rescan vault folder"));
    await vi.waitFor(() =>
      expect(useToast.getState().toasts.at(-1)?.message).toBe(
        "Rescanned the vault folder — 2 docs",
      ),
    );
  });
});
