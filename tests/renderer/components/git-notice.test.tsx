import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { GitNotice } from "@/components/git-notice/git-notice.component";
import { useApp } from "@/stores/app";
import type { GitStatus } from "@shared/types";
import { mockMarascaApi } from "../helpers/mock-marasca-api";

const ready: GitStatus = {
  state: "ready",
  version: "2.39.5",
  binary: "/usr/bin/git",
  source: "apple",
};

describe("GitNotice", () => {
  it("says git is ready in one line, or nothing where only problems matter", () => {
    mockMarascaApi();
    useApp.setState({ gitStatus: ready });
    const { rerender } = render(<GitNotice />);
    expect(screen.getByText("git 2.39.5 is ready")).toBeTruthy();
    rerender(<GitNotice hideWhenReady />);
    expect(screen.queryByText("git 2.39.5 is ready")).toBeNull();
  });

  it("starts Apple's installer and follows the status main sends back", async () => {
    const { invoke, emit } = mockMarascaApi({
      "git:installTools": { state: "installing", startedAt: 1 },
    });
    useApp.setState({ gitStatus: { state: "missing" } });
    render(<GitNotice />);

    await userEvent.click(screen.getByRole("button", { name: "Install tools" }));
    expect(invoke).toHaveBeenCalledWith("git:installTools");
    expect(await screen.findByText("Installing Apple's Command Line Tools")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the installer again" })).toBeTruthy();

    // The store listens for git:status, as the app does once subscribed.
    useApp.setState({ gitStatus: ready });
    emit("git:status", ready);
    expect(await screen.findByText("git 2.39.5 is ready")).toBeTruthy();
  });

  it("lets someone point at a git of their own", async () => {
    const { invoke } = mockMarascaApi({ "git:choosePath": null });
    useApp.setState({ gitStatus: { state: "missing" } });
    render(<GitNotice />);
    await userEvent.click(screen.getByRole("button", { name: "I have git somewhere else…" }));
    expect(invoke).toHaveBeenCalledWith("git:choosePath");
    // Cancelled: nothing changes.
    expect(screen.getByRole("button", { name: "Install tools" })).toBeTruthy();
  });

  it("shows the licence command to copy, and rechecks", async () => {
    const { invoke } = mockMarascaApi({ "git:recheck": ready });
    useApp.setState({ gitStatus: { state: "license", binary: "/usr/bin/git" } });
    render(<GitNotice />);
    expect(screen.getByText("sudo xcodebuild -license accept")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(invoke).toHaveBeenCalledWith("git:recheck");
    expect(await screen.findByText("git 2.39.5 is ready")).toBeTruthy();
  });
});
