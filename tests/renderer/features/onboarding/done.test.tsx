import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Done } from "@/features/onboarding/components/done/done.component";
import { useApp } from "@/stores/app";
import type { IndexSnapshot, VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const config = { root: "/v", remote: "nunu/vault2", branch: "main" } as VaultConfig;
const withDocs = (n: number) =>
  ({
    docs: Array.from({ length: n }, (_, i) => ({ path: `${i}.md` })),
  }) as unknown as IndexSnapshot;

beforeEach(() => {
  window.location.hash = "onboarding";
  useApp.setState({
    config,
    gitStatus: { state: "ready", version: "2.39.5", binary: "/usr/bin/git", source: "apple" },
  });
});

describe("Done", () => {
  it("says where commits go and which git makes them", () => {
    mockMarascaApi();
    useApp.setState({ index: withDocs(7) });
    render(<Done />);
    expect(screen.getByText("Your vault is ready")).toBeTruthy();
    expect(screen.getByText(/7 documents indexed/)).toBeTruthy();
    expect(screen.getByText("nunu/vault2")).toBeTruthy();
    expect(screen.getByText("git 2.39.5 is ready")).toBeTruthy();
  });

  it("leads with opening a vault that already has documents", async () => {
    mockMarascaApi();
    useApp.setState({ index: withDocs(7) });
    render(<Done />);
    expect(screen.queryByText(/Save my first document/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Open the vault/ }));
    expect(window.location.hash).toBe("#main");
  });

  it("leads with the first document when the vault is empty", async () => {
    const { invoke } = mockMarascaApi();
    useApp.setState({ index: withDocs(0) });
    render(<Done />);
    await userEvent.click(screen.getByRole("button", { name: /Save my first document/ }));
    expect(invoke).toHaveBeenCalledWith("window:openEditor");
  });
});
