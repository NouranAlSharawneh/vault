import { render, screen, within } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Settings } from "@/features/settings/settings.component";
import { useApp } from "@/stores/app";
import type { AuthState, VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const config: VaultConfig = {
  root: "/Users/nunu/Documents/vault",
  remote: "nunu/vault2",
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
  assetDirs: { atlas: "/Users/nunu/Projects/atlas/img" },
};

const signedIn: AuthState = {
  status: "signed-in",
  user: { login: "nunu", name: "Nunu", avatarUrl: "https://example.com/a.png" },
  method: null,
};
const signedOut: AuthState = { status: "signed-out", user: null, method: null };

function renderSettings(patch: Partial<VaultConfig> = {}, auth: AuthState = signedIn) {
  mockMarascaApi({
    "app:version": "0.1.0",
    "hotkey:status": null,
    "auth:tokenStatus": null,
  });
  useApp.setState({ config: { ...config, ...patch }, auth, trash: [] });
  render(<Settings />);
}

describe("Settings layout", () => {
  it("puts the settings in five titled groups, the danger zone last", () => {
    renderSettings();
    const groups = screen.getAllByRole("region").map((g) => g.getAttribute("aria-label"));
    expect(groups).toEqual(["Capture", "GitHub", "Storage", "Updates", "Danger zone"]);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  });

  it("keeps destructive actions out of the everyday groups", () => {
    renderSettings();
    const storage = screen.getByRole("region", { name: "Storage" });
    expect(within(storage).queryByText(/Empty trash/)).toBeNull();
    const danger = screen.getByRole("region", { name: "Danger zone" });
    expect(within(danger).getAllByText(/Empty trash/).length).toBeGreaterThan(0);
    expect(within(danger).getByText("Reset…")).toBeTruthy();
  });

  it("shows the push delay only when there is somewhere to push", () => {
    renderSettings({ remote: null });
    expect(screen.queryByLabelText("push delay")).toBeNull();
    expect(screen.getByText("Connect a repo")).toBeTruthy();
  });

  it("offers sign-in, not a repo, when signed out of a local vault", () => {
    renderSettings({ remote: null }, signedOut);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByText("Connect a repo")).toBeNull();
  });

  it("lists each remembered image folder with its own Forget", () => {
    renderSettings();
    expect(screen.getByText("~/Projects/atlas/img")).toBeTruthy();
    expect(screen.getAllByText("Forget")).toHaveLength(1);
  });
});
