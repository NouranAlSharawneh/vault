import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  exposed: {} as Record<string, unknown>,
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => {
      electron.exposed[key] = value;
    },
  },
  ipcRenderer: {
    invoke: electron.invoke,
    on: electron.on,
    removeListener: electron.removeListener,
  },
}));

import type { IpcRendererEvent } from "electron";
import { EVENT_CHANNELS, INVOKE_CHANNELS, type MarascaApi } from "@shared/ipc";

async function bridge(): Promise<MarascaApi> {
  vi.resetModules();
  await import("../../../src/preload/index");

  return electron.exposed.marasca as MarascaApi;
}

describe("the preload bridge", () => {
  beforeEach(() => {
    electron.exposed = {};
    electron.invoke.mockReset().mockResolvedValue("result");
    electron.on.mockReset();
    electron.removeListener.mockReset();
  });

  it("is the only thing the renderer gets — no ipcRenderer, no node", async () => {
    await bridge();

    expect(Object.keys(electron.exposed)).toEqual(["marasca"]);
    expect(Object.keys(electron.exposed.marasca as object).sort()).toEqual(["invoke", "on"]);
  });

  it("forwards a known invoke channel untouched", async () => {
    const api = await bridge();
    await expect(api.invoke("vault:index")).resolves.toBe("result");

    expect(electron.invoke).toHaveBeenCalledWith("vault:index");
  });

  it("passes the arguments through", async () => {
    const api = await bridge();
    await api.invoke("doc:read", "atlas/spec.md");

    expect(electron.invoke).toHaveBeenCalledWith("doc:read", "atlas/spec.md");
  });

  it("refuses a channel that is not on the list, without touching ipcRenderer", async () => {
    const api = await bridge();

    await expect((api.invoke as (c: string) => Promise<unknown>)("shell:exec")).rejects.toThrow(
      "Unknown channel shell:exec",
    );
    expect(electron.invoke).not.toHaveBeenCalled();
  });

  it("rejects rather than throws, so a caller's .catch still works", async () => {
    const api = await bridge();
    const result = (api.invoke as (c: string) => Promise<unknown>)("anything");

    expect(result).toBeInstanceOf(Promise);
    await expect(result).rejects.toThrow();
  });

  it("subscribes to a known event and unwraps the electron event object", async () => {
    const api = await bridge();
    const heard: unknown[] = [];
    api.on("index:changed", (payload) => heard.push(payload));

    const [channel, wrapped] = electron.on.mock.calls[0] as [
      string,
      (e: IpcRendererEvent, p: unknown) => void,
    ];
    expect(channel).toBe("index:changed");
    wrapped({} as IpcRendererEvent, { docs: [] });

    expect(heard).toEqual([{ docs: [] }]);
  });

  it("hands back an unsubscribe that removes the very listener it added", async () => {
    const api = await bridge();
    const off = api.on("sync:status", () => undefined);
    const [, wrapped] = electron.on.mock.calls[0] as [string, unknown];
    off();

    expect(electron.removeListener).toHaveBeenCalledWith("sync:status", wrapped);
  });

  it("throws on an unknown event channel", async () => {
    const api = await bridge();

    expect(() => api.on("everything" as never, () => undefined)).toThrow(
      "Unknown event everything",
    );
    expect(electron.on).not.toHaveBeenCalled();
  });

  it("allows every channel the main process actually handles", async () => {
    // The two lists are the contract. A channel added to one and not the other is a
    // runtime "Unknown channel" the moment a user reaches that feature.
    const api = await bridge();
    const invoke = api.invoke as (channel: string) => Promise<unknown>;
    for (const channel of INVOKE_CHANNELS) {
      await expect(invoke(channel)).resolves.toBe("result");
    }
    for (const channel of EVENT_CHANNELS) {
      expect(() => api.on(channel as never, () => undefined)).not.toThrow();
    }
  });
});
