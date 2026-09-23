import { create } from "zustand";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import type { IndexSnapshot, ScanProgress } from "@shared/types";
import type { AppState } from "./app.types";

const EMPTY_PROGRESS: ScanProgress = { phase: "idle", done: 0, total: 0 };

/**
 * Everything the library needs from an open vault. Settled one by one: a trash folder
 * that can't be listed is no reason to hide every document, and a sync status that
 * didn't arrive is "not known yet", not "pushed".
 */
async function loadVault(index: () => Promise<IndexSnapshot>): Promise<Partial<AppState>> {
  let snapshot: IndexSnapshot;
  try {
    snapshot = await index();
  } catch (e) {
    return { index: null, vaultError: errorMessage(e), sync: null, trash: [] };
  }
  const [sync, trash] = await Promise.allSettled([api("sync:status"), api("trash:list")]);

  return {
    index: snapshot,
    vaultError: null,
    sync: sync.status === "fulfilled" ? sync.value : null,
    trash: trash.status === "fulfilled" ? trash.value : [],
  };
}

export const useApp = create<AppState>((set) => ({
  ready: false,
  auth: { status: "signed-out", user: null, method: null },
  config: null,
  index: null,
  vaultError: null,
  progress: EMPTY_PROGRESS,
  sync: null,
  trash: [],
  platform: "darwin",

  boot: async () => {
    const [auth, config, platform] = await Promise.all([
      api("auth:state").catch(() => ({ status: "signed-out", user: null, method: null }) as const),
      api("vault:config").catch(() => null),
      api("app:platform").catch(() => "darwin"),
    ]);
    const vault = config ? await loadVault(() => api("vault:index")) : {};
    set({ auth, config, platform, ...vault, ready: true });
  },

  reopenVault: async () => {
    set(await loadVault(() => api("vault:reopen")));
  },

  refreshIndex: async () => {
    set({ index: await api("vault:index"), vaultError: null });
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
