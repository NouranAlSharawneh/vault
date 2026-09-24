import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VaultUnavailable } from "@/features/main/components/vault-unavailable/vault-unavailable.component";
import { useApp } from "@/stores/app";
import type { VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

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
    mockMarascaApi();
    useApp.setState({ config: null, vaultError: null });
    render(<VaultUnavailable />);
    expect(screen.getByText("No vault connected")).toBeTruthy();
  });

  it("says which vault failed and why, not that it is empty", () => {
    mockMarascaApi();
    useApp.setState({ config, vaultError: "EACCES: permission denied" });
    render(<VaultUnavailable />);
    expect(screen.getByText("Marasca couldn’t open ~/Documents/vault.")).toBeTruthy();
    expect(screen.getByText("EACCES: permission denied")).toBeTruthy();
  });

  it("tries again, shows the folder, or starts over", async () => {
    const { invoke } = mockMarascaApi({ "vault:reopen": new Error("still no") });
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

describe("VaultUnavailable — when git is the reason", () => {
  const gitError = "Error: Marasca needs git before it can open the vault.";

  it("explains, offers the fix, and says the documents are still there", () => {
    mockMarascaApi();
    useApp.setState({
      config,
      vaultError: gitError,
      gitStatus: { state: "broken", developerDir: "/x" },
    });
    render(<VaultUnavailable />);
    expect(screen.getByText("Marasca needs git to open your vault")).toBeTruthy();
    expect(screen.getByText(/Your documents are still in ~\/Documents\/vault/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reinstall tools" })).toBeTruthy();
  });

  it("opens the vault by itself once git works again", async () => {
    const { invoke } = mockMarascaApi({ "vault:reopen": new Error("later") });
    useApp.setState({
      config,
      vaultError: gitError,
      gitStatus: { state: "installing", startedAt: 1 },
    });
    render(<VaultUnavailable />);
    expect(invoke).not.toHaveBeenCalledWith("vault:reopen");
    useApp.setState({
      gitStatus: { state: "ready", version: "2.39.5", binary: "/usr/bin/git", source: "apple" },
    });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("vault:reopen"));
  });
});
