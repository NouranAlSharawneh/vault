import { create } from "zustand";
import type { IndexSnapshot, ScanProgress, SyncStatus } from "@shared/types";
import { api } from "@/lib/api";
import type { AppState } from "./app.types";

const EMPTY_PROGRESS: ScanProgress = { phase: "idle", done: 0, total: 0 };

export const useApp = create<AppState>((set) => ({
  ready: false,
  auth: { status: "signed-out", user: null, method: null },
  config: null,
  index: null,
  progress: EMPTY_PROGRESS,
  sync: null,
  platform: "darwin",

  boot: async () => {
    const [auth, config, platform] = await Promise.all([
      api("auth:state"),
      api("vault:config"),
      api("app:platform"),
    ]);
    let index: IndexSnapshot | null = null;
    let sync: SyncStatus | null = null;
    if (config) {
      try {
        [index, sync] = await Promise.all([api("vault:index"), api("sync:status")]);
      } catch {
        /* vault not open yet */
      }
    }
    set({ auth, config, index, sync, platform, ready: true });
  },

  refreshIndex: async () => {
    set({ index: await api("vault:index") });
  },

  setConfig: (config) => set({ config }),
}));
