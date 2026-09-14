// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { useApp } from "@/stores/app";
import { mockVaultApi } from "../helpers/mock-vault-api";

const config = {
  root: "/tmp/v",
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "claude" as const,
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};
const status = (state: "synced" | "pending" | "pushing" | "offline" | "error", ahead = 0) => ({
  state,
  ahead,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: state === "error" ? "401 Bad credentials" : null,
  remote: "nunu/vault",
  conflicts: 0,
});

describe("SyncBadge", () => {
  it("shows 'local' with no remote", () => {
    mockVaultApi();
    useApp.setState({ config: { ...config, remote: null }, sync: null });
    render(<SyncBadge />);
    expect(screen.getByText("local")).toBeTruthy();
  });

  it.each([
    ["synced", 0, "pushed"],
    ["pending", 3, "3 not pushed"],
    ["pushing", 1, "pushing…"],
    ["offline", 2, "offline · 2 waiting"],
    ["error", 1, "push failed"],
  ] as const)("%s → %s", (state, ahead, label) => {
    mockVaultApi();
    useApp.setState({ config, sync: status(state, ahead) });
    render(<SyncBadge />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("asks for a review only when something is waiting, and only where it can show one", () => {
    mockVaultApi();
    const onReviewConflicts = vi.fn();
    useApp.setState({ config, sync: { ...status("synced"), conflicts: 2 } });
    // Being pushed and owing an answer are separate facts; both are said.
    render(<SyncBadge onReviewConflicts={onReviewConflicts} />);
    expect(screen.getByText("pushed")).toBeTruthy();
    expect(screen.getByText("2 to review")).toBeTruthy();
    // The editor window has nowhere to open a review, so it does not offer one.
    render(<SyncBadge />);
    expect(screen.getAllByText("2 to review")).toHaveLength(1);
  });

  it("pushes now when clicked in a pending state, not when already synced", async () => {
    const { invoke } = mockVaultApi();
    useApp.setState({ config, sync: status("pending", 2) });
    render(<SyncBadge />);
    await userEvent.click(screen.getByRole("button"));
    expect(invoke).toHaveBeenCalledWith("sync:pushNow");
    invoke.mockClear();
    useApp.setState({ sync: status("synced") });
    render(<SyncBadge />);
    await userEvent.click(screen.getAllByRole("button")[1]);
    expect(invoke).not.toHaveBeenCalledWith("sync:pushNow");
  });
});
