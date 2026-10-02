import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { UpdateCheck } from "@/features/settings/components/update-check/update-check.component";
import { useApp } from "@/stores/app";
import { subscribeToMain } from "@/stores/app/subscribe-to-main";
import type { UpdateCheck as UpdateCheckResult } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const checkButton = () => screen.getByRole("button", { name: /Check for updates/ });

function setup(answer: UpdateCheckResult | Error, install: unknown = undefined) {
  const mock = mockMarascaApi({
    "app:checkForUpdates": answer,
    "app:openExternal": undefined,
    "app:installUpdate": install,
  });
  render(<UpdateCheck version="0.0.1" />);

  return mock;
}

const AVAILABLE: UpdateCheckResult = {
  status: "available",
  current: "0.0.1",
  latest: "0.0.2",
  url: "https://github.com/NouranAlSharawneh/vault/releases/tag/v0.0.2",
};

describe("UpdateCheck", () => {
  afterEach(() => useApp.setState({ update: null, install: null }));

  it("offers the version the background check found, without asking again", () => {
    // The gear's dot sent you here: the download is waiting, not one more click away.
    useApp.setState({
      update: { status: "available", current: "0.0.1", latest: "0.0.2", url: "https://x" },
    });
    const { invoke } = setup({ status: "up-to-date", current: "0.0.1", latest: "0.0.1" });
    expect(screen.getByRole("button", { name: /Update to 0.0.2/ })).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows this version and doesn't touch the network until asked", () => {
    const { invoke } = setup({ status: "up-to-date", current: "0.0.1", latest: "0.0.1" });
    expect(screen.getByText("You’re on version 0.0.1.")).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says so when you're up to date", async () => {
    setup({ status: "up-to-date", current: "0.0.1", latest: "0.0.1" });
    await userEvent.click(checkButton());
    expect(await screen.findByText("You’re up to date (0.0.1).")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
  });

  it("installs a newer version with one click", async () => {
    const { invoke } = setup(AVAILABLE);
    await userEvent.click(checkButton());
    expect(await screen.findByText("Version 0.0.2 is out. You’re on 0.0.1.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Update to 0\.0\.2/ }));
    expect(invoke).toHaveBeenCalledWith("app:installUpdate", "0.0.2");
    expect(invoke).not.toHaveBeenCalledWith("app:openExternal", expect.anything());
  });

  it("shows the download, then the restart, as main reports them", async () => {
    useApp.setState({ update: AVAILABLE });
    const { emit } = setup(AVAILABLE);
    subscribeToMain();
    act(() =>
      emit("app:updateInstall", {
        phase: "downloading",
        version: "0.0.2",
        received: 42 * 1024 * 1024,
        total: 100 * 1024 * 1024,
      }),
    );
    expect(screen.getByText("Downloading 0.0.2… 42% of 100 MB")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Downloading…/ }).hasAttribute("disabled")).toBe(
      true,
    );
    // Nothing to check while an install runs.
    expect(checkButton().hasAttribute("disabled")).toBe(true);
    act(() => emit("app:updateInstall", { phase: "restarting", version: "0.0.2" }));
    expect(screen.getByText("Restarting into 0.0.2…")).toBeTruthy();
  });

  it("says why an install failed, and offers another try or the download page", async () => {
    useApp.setState({ update: AVAILABLE });
    const { invoke } = setup(
      AVAILABLE,
      new Error("Error invoking remote method 'app:installUpdate': Error: The download stalled."),
    );
    await userEvent.click(screen.getByRole("button", { name: /Update to 0\.0\.2/ }));
    expect(await screen.findByText("The download stalled.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Download page/ }));
    expect(invoke).toHaveBeenCalledWith("app:openExternal", AVAILABLE.url);
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(invoke.mock.calls.filter((c) => c[0] === "app:installUpdate")).toHaveLength(2);
  });

  it("offers the download page where this copy can't replace itself", async () => {
    const reason =
      "Marasca is running from the disk image. Drag it to Applications, then update from there.";
    useApp.setState({ update: AVAILABLE, install: { phase: "manual", reason } });
    const { invoke } = setup(AVAILABLE);
    expect(screen.getByText(new RegExp(reason))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Update to/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Download 0\.0\.2/ }));
    expect(invoke).toHaveBeenCalledWith("app:openExternal", AVAILABLE.url);
  });

  it("explains an empty release list instead of claiming you're up to date", async () => {
    setup({ status: "none", current: "0.0.1" });
    await userEvent.click(checkButton());
    expect(await screen.findByText(/No releases published yet/)).toBeTruthy();
  });

  it("says it couldn't check when GitHub is unreachable, and can try again", async () => {
    const { invoke } = setup(new Error("offline"));
    await userEvent.click(checkButton());
    expect(await screen.findByText(/Couldn’t reach GitHub/)).toBeTruthy();
    await userEvent.click(checkButton());
    expect(invoke.mock.calls.filter((c) => c[0] === "app:checkForUpdates")).toHaveLength(2);
  });
});
