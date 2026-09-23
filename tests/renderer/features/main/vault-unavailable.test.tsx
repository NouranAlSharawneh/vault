import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { VaultUnavailable } from "@/features/main/components/vault-unavailable/vault-unavailable.component";
import { useApp } from "@/stores/app";
import type { VaultConfig } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const config: VaultConfig = {
  root: "/Users/nunu/Documents/vault",
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "claude",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

beforeEach(() => {
  window.location.hash = "main";
});

describe("VaultUnavailable", () => {
  it("still asks to set up when there is no vault at all", () => {
    mockVaultApi();
    useApp.setState({ config: null, vaultError: null });
    render(<VaultUnavailable />);
    expect(screen.getByText("No vault connected")).toBeTruthy();
  });

  it("says which vault failed and why, not that it is empty", () => {
    mockVaultApi();
    useApp.setState({ config, vaultError: "EACCES: permission denied" });
    render(<VaultUnavailable />);
    expect(screen.getByText("Vault couldn’t open ~/Documents/vault.")).toBeTruthy();
    expect(screen.getByText("EACCES: permission denied")).toBeTruthy();
  });

  it("tries again, shows the folder, or starts over", async () => {
    const { invoke } = mockVaultApi({ "vault:reopen": new Error("still no") });
    useApp.setState({ config, vaultError: "EACCES: permission denied" });
    render(<VaultUnavailable />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invoke).toHaveBeenCalledWith("vault:reopen");
    expect(await screen.findByText("still no")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    expect(invoke).toHaveBeenCalledWith("vault:revealInFinder");

    await userEvent.click(screen.getByRole("button", { name: "Set up again" }));
    expect(window.location.hash).toBe("#onboarding?connect");
  });
});
