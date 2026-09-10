import { create } from "zustand";
import type { IndexSnapshot, ScanProgress, SyncStatus, TrashedDoc } from "@shared/types";
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
  trash: [],
  platform: "darwin",

  boot: async () => {
    const [auth, config, platform] = await Promise.all([
      api("auth:state"),
      api("vault:config"),
      api("app:platform"),
    ]);
    let index: IndexSnapshot | null = null;
    let sync: SyncStatus | null = null;
    let trash: TrashedDoc[] = [];
    if (config) {
      try {
        [index, sync, trash] = await Promise.all([
          api("vault:index"),
          api("sync:status"),
          api("trash:list"),
        ]);
      } catch {
        /* vault not open yet */
      }
    }
    set({ auth, config, index, sync, trash, platform, ready: true });
  },

  refreshIndex: async () => {
    set({ index: await api("vault:index") });
  },

  refreshTrash: async () => {
    try {
      set({ trash: await api("trash:list") });
    } catch {
      /* no vault */
    }
  },

  setConfig: (config) => set({ config }),
}));
