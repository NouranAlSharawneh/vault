import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { NoWriteAccessBanner } from "@/components/no-write-access-banner/no-write-access-banner.component";
import { useApp } from "@/stores/app";
import type { SyncStatus, VaultConfig } from "@shared/types";
import { mockVaultApi } from "../helpers/mock-vault-api";

const config: VaultConfig = {
  root: "/tmp/v",
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "claude",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};
const sync = (patch: Partial<SyncStatus> = {}): SyncStatus => ({
  state: "error",
  ahead: 1,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: "remote: Permission to nunu/vault.git denied",
  remote: "nunu/vault",
  conflicts: 0,
  failure: "no-permission",
  ...patch,
});

describe("NoWriteAccessBanner", () => {
  it("names the repo and says the documents are still safe", () => {
    mockVaultApi();
    useApp.setState({ config, sync: sync() });
    render(<NoWriteAccessBanner />);
    expect(
      screen.getByText(
        /You don’t have write access to nunu\/vault\. Documents still save on this Mac\./,
      ),
    ).toBeTruthy();
  });

  it("offers another repo and the repo on GitHub", async () => {
    const { invoke } = mockVaultApi();
    useApp.setState({ config, sync: sync() });
    render(<NoWriteAccessBanner />);
    await userEvent.click(screen.getByRole("button", { name: "Connect a different repo" }));
    expect(invoke).toHaveBeenCalledWith("window:openMain", "onboarding?connect");
    await userEvent.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(invoke).toHaveBeenCalledWith("github:openInBrowser", "nunu/vault");
  });

  it("stays out of the way for every other failure, and once a push lands", () => {
    mockVaultApi();
    useApp.setState({ config, sync: sync({ failure: "other" }) });
    const { rerender, container } = render(<NoWriteAccessBanner />);
    expect(container.textContent).toBe("");
    useApp.setState({ sync: sync({ state: "synced", failure: null }) });
    rerender(<NoWriteAccessBanner />);
    expect(container.textContent).toBe("");
  });
});
