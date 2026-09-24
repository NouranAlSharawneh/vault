// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VaultFooter } from "@/features/main/components/vault-footer/vault-footer.component";
import type { VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const config = {
  root: "/Users/nunu/Documents/vault2",
  remote: "NouranAlSharawneh/vault2",
  branch: "main",
} as VaultConfig;

describe("VaultFooter", () => {
  it("puts the repo name on its own line, with the owner under it", () => {
    mockMarascaApi();
    render(<VaultFooter config={config} onSettings={vi.fn()} />);
    expect(screen.getByText("vault2")).toBeTruthy();
    expect(screen.getByText("NouranAlSharawneh")).toBeTruthy();
    expect(screen.queryByText("NouranAlSharawneh/vault2")).toBeNull();
  });

  it("opens the repo on GitHub, and Settings from the one icon", () => {
    const { invoke } = mockMarascaApi();
    const onSettings = vi.fn();
    render(<VaultFooter config={config} onSettings={onSettings} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open NouranAlSharawneh/vault2 on GitHub" }),
    );
    expect(invoke).toHaveBeenCalledWith("github:openInBrowser");
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    expect(onSettings).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("shows a local vault as its folder, and reveals it in Finder", () => {
    const { invoke } = mockMarascaApi();
    render(<VaultFooter config={{ ...config, remote: null }} onSettings={vi.fn()} />);
    expect(screen.getByText("Local vault")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /in Finder/ }));
    expect(invoke).toHaveBeenCalledWith("vault:revealInFinder");
  });
});
