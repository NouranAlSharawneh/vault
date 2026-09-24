import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { EVENT_CHANNELS, INVOKE_CHANNELS, type MarascaApi } from "@shared/ipc";

const invokeSet = new Set<string>(INVOKE_CHANNELS);
const eventSet = new Set<string>(EVENT_CHANNELS);

const api: MarascaApi = {
  invoke: (channel, ...args) => {
    if (!invokeSet.has(channel)) return Promise.reject(new Error(`Unknown channel ${channel}`));

    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, listener) => {
    if (!eventSet.has(channel)) throw new Error(`Unknown event ${channel}`);
    const wrapped = (_: IpcRendererEvent, payload: unknown) => listener(payload as never);
    ipcRenderer.on(channel, wrapped);

    return () => ipcRenderer.removeListener(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld("marasca", api);
