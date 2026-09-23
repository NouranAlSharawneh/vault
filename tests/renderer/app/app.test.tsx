import { act, render, screen, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/app.component";
import { fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import { mockVaultApi } from "../helpers/mock-vault-api";

const config = {
  root: "/tmp/v",
  remote: null,
  branch: "main",
  lastProject: null,
  lastSource: "manual" as const,
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

/**
 * jsdom has no layout: the capture sheet measures itself with a ResizeObserver and
 * CodeMirror in the editor asks a Range for its rects. Neither matters here.
 */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;
Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

async function renderAt(route: string) {
  window.location.hash = route;
  mockVaultApi({
    "auth:state": { status: "signed-in", user: null, method: "pat" },
    "app:platform": "darwin",
    "vault:config": config,
    "vault:index": { docs: [], projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 0 },
    "sync:status": null,
    "trash:list": [],
  });
  render(<App />);
  await waitFor(() => expect(useApp.getState().ready).toBe(true));
}

async function failSomething() {
  await act(async () => {
    fire(Promise.reject(new Error("disk full")), "Couldn’t save that — the disk is full");
    await Promise.resolve();
  });
}

/** The toast host's live region. Routes may have status regions of their own (capture's
 *  "Reading the clipboard"), so match the polite live region rather than any status. */
const liveRegions = () =>
  screen.getAllByRole("status").filter((el) => el.getAttribute("aria-live") === "polite");

describe("App", () => {
  // `fire` logs every failure on purpose; the test expects them.
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => {
    useToast.getState().dismiss();
    useApp.setState({ ready: false });
    window.location.hash = "";
    vi.restoreAllMocks();
  });

  // `fire` reports into one store per window. Every window has to draw it, not just main.
  it.each(["onboarding", "settings", "capture", "editor"])(
    "shows a failure on the %s route",
    async (route) => {
      await renderAt(route);
      await failSomething();
      expect(liveRegions()[0]?.textContent).toBe("Couldn’t save that — the disk is full");
      expect(screen.getAllByText("Couldn’t save that — the disk is full")).toHaveLength(2);
    },
  );

  it("draws one host in the main window, not one per layer", async () => {
    await renderAt("main");
    await failSomething();
    expect(liveRegions()).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "dismiss" })).toHaveLength(1);
  });
});
