import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VaultUnavailable } from "@/features/main/components/vault-unavailable/vault-unavailable.component";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
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

describe("VaultUnavailable — when the folder was moved", () => {
  const gone = "The folder isn’t there any more. It may have been moved, renamed or deleted.";
  const moved = { ...config, root: "/Users/nunu/Files/vault" };

  it("asks where it went, and opens the vault from there", async () => {
    const { invoke } = mockMarascaApi({
      "vault:relocate": moved,
      "vault:index": { docs: [], projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 1 },
      "trash:list": [],
    });
    useApp.setState({ config, vaultError: gone });
    render(<VaultUnavailable />);

    await userEvent.click(screen.getByRole("button", { name: "Locate…" }));

    expect(invoke).toHaveBeenCalledWith("vault:relocate");
    await vi.waitFor(() => expect(useApp.getState().vaultError).toBeNull());
    expect(useApp.getState().config).toEqual(moved);
  });

  it("says why a folder was refused, and stays put", async () => {
    const refusal = "“Files” isn’t your vault: it has no git history.";
    mockMarascaApi({ "vault:relocate": new Error(refusal) });
    useApp.setState({ config, vaultError: gone });
    render(<VaultUnavailable />);

    await userEvent.click(screen.getByRole("button", { name: "Locate…" }));

    await vi.waitFor(() => expect(useToast.getState().toasts.at(-1)?.message).toBe(refusal));
    expect(useApp.getState().config).toBe(config);
    expect(screen.getByText(gone)).toBeTruthy();
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
