import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateCheck } from "@shared/types";

const m = vi.hoisted(() => ({
  answers: [] as (UpdateCheck | Error)[],
  sent: [] as unknown[],
}));

vi.mock("electron", () => ({ app: { getVersion: () => "0.0.2" } }));
vi.mock("@main/windows/broadcast", () => ({
  broadcast: (_: string, payload: unknown) => m.sent.push(payload),
}));
vi.mock("@main/services/updates/check-for-updates", () => ({
  checkForUpdates: async () => {
    const next = m.answers.shift();
    if (!next || next instanceof Error) throw next ?? new Error("no answer");

    return next;
  },
}));

import {
  refreshUpdateStatus,
  resetUpdateStatus,
  stopWatchingForUpdates,
  updateStatus,
  watchForUpdates,
} from "@main/app/updates/update-watch";
import { UPDATE_CHECK_EVERY_MS, UPDATE_FIRST_CHECK_MS } from "@shared/constants";

const available = (latest: string): UpdateCheck => ({
  status: "available",
  current: "0.0.2",
  latest,
  url: `https://github.com/x/releases/tag/v${latest}`,
});

beforeEach(() => {
  m.answers = [];
  m.sent = [];
  resetUpdateStatus();
});
afterEach(() => {
  stopWatchingForUpdates();
  vi.useRealTimers();
});

describe("the update watch", () => {
  it("tells the windows when the answer changes, and only then", async () => {
    m.answers = [available("0.0.3"), available("0.0.3"), available("0.0.4")];
    await refreshUpdateStatus();
    await refreshUpdateStatus();
    await refreshUpdateStatus();

    expect(m.sent).toEqual([available("0.0.3"), available("0.0.4")]);
    expect(updateStatus()).toEqual(available("0.0.4"));
  });

  it("checks quietly a little after launch and then on a schedule, saying nothing when offline", async () => {
    vi.useFakeTimers();
    m.answers = [new Error("offline"), available("0.0.3")];
    watchForUpdates();
    await vi.advanceTimersByTimeAsync(UPDATE_FIRST_CHECK_MS);
    expect(m.sent).toEqual([]);
    expect(updateStatus()).toBeNull();

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_EVERY_MS - UPDATE_FIRST_CHECK_MS);
    expect(m.sent).toEqual([available("0.0.3")]);
  });
});
