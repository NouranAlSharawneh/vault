import { cleanup, render, screen, within } from "@testing-library/react";
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
    const titles = ["Capture", "GitHub", "Storage", "Updates", "Danger zone"];
    // Each group is a region named by its own heading, so heading navigation reaches it.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(titles);
    for (const name of titles) expect(screen.getByRole("region", { name })).toBeTruthy();
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
    // Named as it reads on screen, "Push after saving" — it used to be "push delay".
    renderSettings();
    expect(screen.getByRole("combobox", { name: "Push after saving" })).toBeTruthy();
    cleanup();
    renderSettings({ remote: null });
    expect(screen.queryByRole("combobox", { name: "Push after saving" })).toBeNull();
    expect(screen.getByText("Connect a repo")).toBeTruthy();
  });

  it("arrives on its heading, and names the window after itself", () => {
    renderSettings();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Settings" }));
    expect(document.title).toBe("Settings — Marasca");
  });

  it("ties each setting's explanation to the control beside it", () => {
    renderSettings();
    const row = screen.getByRole("group", { name: "Push after saving" });
    expect(row.getAttribute("aria-describedby")).toBeTruthy();
    expect(within(row).getByRole("combobox")).toBeTruthy();
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
