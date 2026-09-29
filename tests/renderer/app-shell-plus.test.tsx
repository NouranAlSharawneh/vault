// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts/keyboard-shortcuts.component";
import { firstPushLine } from "@/features/onboarding/components/first-push/first-push-line";
import { continueLabel } from "@/features/onboarding/components/repo-picker/hooks/use-repo-picker.hook";
import { StepIndicator } from "@/features/onboarding/components/step-indicator/step-indicator.component";
import { DiagnosticsRow } from "@/features/settings/components/diagnostics-row/diagnostics-row.component";
import { LoginItemRow } from "@/features/settings/components/login-item-row/login-item-row.component";
import { syncSummary } from "@/features/settings/components/sync-row/sync-summary";
import { describeToken, shortcutLabel, tokenExpiryWarning } from "@/helpers";
import { installWindowEvents } from "@/lib/window-events";
import { useShortcutsSheet } from "@/stores/shortcuts";
import { useToast } from "@/stores/toast";
import type { SyncStatus } from "@shared/types";
import { mockMarascaApi } from "./helpers/mock-marasca-api";

const sync = (over: Partial<SyncStatus> = {}): SyncStatus => ({
  state: "synced",
  ahead: 0,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: null,
  remote: "nunu/vault",
  conflicts: 0,
  failure: null,
  ...over,
});

/** A drop event carrying files, as the browser would dispatch it. */
function drop(files: File[]): DragEvent {
  const e = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(e, "dataTransfer", { value: { types: ["Files"], files } });

  return e;
}

describe("a file dropped on a window", () => {
  let uninstall: () => void;
  beforeEach(() => {
    useToast.getState().dismiss();
    uninstall = installWindowEvents();
  });
  afterEach(() => uninstall());

  it("opens a markdown file in an editor instead of replacing the app with it", async () => {
    const { invoke } = mockMarascaApi();
    const e = drop([new File(["# hi"], "notes.md")]);
    window.dispatchEvent(e);

    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("file:open", "/drop/notes.md"));
  });

  it("turns down anything else in words", () => {
    const { invoke } = mockMarascaApi();
    window.dispatchEvent(drop([new File([""], "photo.png")]));

    expect(invoke).not.toHaveBeenCalledWith("file:open", expect.anything());
    expect(useToast.getState().toasts[0]?.message).toMatch(/markdown files/);
  });

  it("asks main to retry sync when the network comes back", async () => {
    const { invoke } = mockMarascaApi();
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("sync:nudge"));
  });
});

describe("Help ▸ Keyboard Shortcuts", () => {
  afterEach(() => useShortcutsSheet.setState({ open: false }));

  it("opens from the menu and lists what the menus hold", async () => {
    const { emit } = mockMarascaApi({
      "app:shortcuts": [
        {
          title: "File",
          items: [{ label: "Capture from Clipboard", accelerator: "Control+Alt+V" }],
        },
        { title: "Library", items: [{ label: "Move through the list", accelerator: "Up / Down" }] },
      ],
    });
    render(<KeyboardShortcuts />);
    act(() => emit("shortcut", "shortcuts"));

    const sheet = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(await screen.findByText("Capture from Clipboard")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Library" })).toBeTruthy();
    expect(sheet.textContent).toContain(shortcutLabel("Up / Down"));
  });

  it("opens with ⌘/ as well", async () => {
    mockMarascaApi({ "app:shortcuts": [] });
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(window, { key: "/", metaKey: true });

    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
  });
});

describe("Settings", () => {
  it("won't offer open-at-login from a development build, and says why", async () => {
    mockMarascaApi({ "app:loginItem": { openAtLogin: false, available: false } });
    render(<LoginItemRow />);

    expect(await screen.findByText(/Only the installed Marasca/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Open at login" })).toHaveProperty("disabled", true);
  });

  it("turns open-at-login on in the installed app", async () => {
    const { invoke } = mockMarascaApi({
      "app:loginItem": { openAtLogin: false, available: true },
      "app:setLoginItem": { openAtLogin: true, available: true },
    });
    render(<LoginItemRow />);
    const toggle = await screen.findByRole("switch", { name: "Open at login" });
    await waitFor(() => expect(toggle).toHaveProperty("disabled", false));
    await userEvent.click(toggle);

    expect(invoke).toHaveBeenCalledWith("app:setLoginItem", true);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
  });

  it("copies diagnostics and says so", async () => {
    const { invoke } = mockMarascaApi({ "app:copyDiagnostics": "Marasca 0.0.2" });
    render(<DiagnosticsRow />);
    await userEvent.click(screen.getByRole("button", { name: /Copy diagnostics/ }));

    expect(invoke).toHaveBeenCalledWith("app:copyDiagnostics");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("says since when this Mac reached GitHub, and when it tries again", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    expect(syncSummary(sync({ lastPushAt: now - 3 * 60_000, lastPullAt: now - 30_000 }), now)).toBe(
      "Pushed 3m ago · pulled just now",
    );
    expect(syncSummary(sync({ nextRetryAt: now + 60_000 }), now)).toMatch(/trying again at/);
    expect(syncSummary(sync(), now)).toBe("Nothing pushed or pulled since Marasca opened");
  });

  it("warns a week before a pasted token lapses, and not before", () => {
    const now = Date.parse("2026-09-29T00:00:00Z");
    const token = (days: number) => ({
      present: true,
      expiresAt: now + days * 86_400_000,
      canRefresh: false,
    });
    expect(tokenExpiryWarning(token(30), now)).toBeNull();
    expect(tokenExpiryWarning(token(5), now)).toMatch(/expires in 5 days/);
    expect(tokenExpiryWarning(token(-1), now)).toMatch(/has expired/);
    // One that renews itself needs nobody to act.
    expect(tokenExpiryWarning({ ...token(1), canRefresh: true }, now)).toBeNull();
    expect(describeToken(token(30), now, "pat")).toMatch(
      /Personal access token — expires in 30 days/,
    );
  });
});

describe("setup", () => {
  it("labels Continue by what it will do", () => {
    expect(continueLabel("new", "nunu", "vault", false)).toBe("Create nunu/vault");
    expect(continueLabel("nunu/notes", "nunu", "vault", false)).toBe("Use nunu/notes");
    expect(continueLabel("local", "nunu", "vault", false)).toBe("Create local vault");
    expect(continueLabel("nunu/notes", "nunu", "vault", true)).toBe("Connect nunu/notes");
    expect(continueLabel(null, "nunu", "vault", false)).toBe("Continue");
  });

  it("shows the first push as it goes", () => {
    expect(firstPushLine(sync({ state: "pushing" }), "nunu/vault").text).toBe(
      "Pushing to nunu/vault…",
    );
    expect(firstPushLine(sync({ lastPushAt: 1 }), "nunu/vault")).toEqual({
      tone: "ok",
      text: "Pushed — nunu/vault has everything.",
    });
    expect(
      firstPushLine(sync({ failure: "no-permission", state: "error" }), "nunu/vault").tone,
    ).toBe("warn");
    expect(firstPushLine(null, "nunu/vault").text).toBe("Checking GitHub…");
  });

  it("says which step this is, out of how many", () => {
    render(<StepIndicator step="repo" />);
    expect(screen.getByText("Step 3 of 5: Choose where the vault lives")).toBeTruthy();
  });
});
