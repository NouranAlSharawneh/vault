import { beforeEach, describe, expect, it, vi } from "vitest";

// Launch, a second launch and the dock icon all decide where the main window goes through
// one helper. Its inputs — settings, the open vault, the current window — are stubbed.
const state = vi.hoisted(() => ({
  onboarded: true,
  vault: {} as object | null,
  mainWindow: null as object | null,
}));
const openMainWindow = vi.hoisted(() => vi.fn());

vi.mock("@main/store/settings.store", () => ({
  getSettings: () => ({ onboarded: state.onboarded }),
}));
vi.mock("@main/app/session/session", () => ({
  session: {
    get vault() {
      return state.vault;
    },
  },
}));
vi.mock("@main/windows", () => ({
  getMainWindow: () => state.mainWindow,
  openMainWindow,
}));

import { launchRoute, showMainWindow } from "@main/app/session/launch-route";

beforeEach(() => {
  state.onboarded = true;
  state.vault = {};
  state.mainWindow = null;
  openMainWindow.mockClear();
});

describe("launchRoute", () => {
  it("is Main once onboarding is done and a vault is open", () => {
    expect(launchRoute()).toBe("main");
  });

  it("is onboarding before onboarding is done", () => {
    state.onboarded = false;
    expect(launchRoute()).toBe("onboarding");
  });

  it("is onboarding when the vault could not be opened", () => {
    state.vault = null;
    expect(launchRoute()).toBe("onboarding");
  });
});

describe("showMainWindow", () => {
  it("opens a new window where launch would", () => {
    state.onboarded = false;
    showMainWindow();
    expect(openMainWindow).toHaveBeenCalledWith("onboarding");
  });

  it("only brings an open window forward, leaving it where it is", () => {
    // A second launch used to navigate the open window to Main, pulling you out of
    // Settings or onboarding halfway through.
    state.mainWindow = {};
    showMainWindow();
    expect(openMainWindow).toHaveBeenCalledWith();
  });
});
