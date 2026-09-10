import { useCallback, useState } from "react";
import type { VaultConfig } from "@shared/types";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { SettingsState } from "../settings.types";

/** Read config from the store, write patches through main, surface refusals (bad hotkey). */
export function useSettings() {
  const config = useApp((s) => s.config);
  const auth = useApp((s) => s.auth);
  const index = useApp((s) => s.index);
  const trash = useApp((s) => s.trash);
  const setConfig = useApp((s) => s.setConfig);
  const refreshTrash = useApp((s) => s.refreshTrash);
  const show = useToast((s) => s.show);
  const [state, setState] = useState<SettingsState>({ error: null, busy: null });

  const update = useCallback(
    async (patch: Partial<VaultConfig>) => {
      const key = Object.keys(patch)[0] as keyof VaultConfig;
      setState({ error: null, busy: key });
      try {
        setConfig(await api("vault:updateConfig", patch));
        setState({ error: null, busy: null });
        return true;
      } catch (e) {
        setState({ error: errorMessage(e), busy: null });
        return false;
      }
    },
    [setConfig],
  );

  const forgetAssetDir = useCallback(
    (slug: string) => {
      const assetDirs = { ...(config?.assetDirs ?? {}) };
      delete assetDirs[slug];
      return update({ assetDirs });
    },
    [config?.assetDirs, update],
  );

  const emptyTrash = useCallback(async () => {
    setState((s) => ({ ...s, busy: "trash" }));
    try {
      const { removed } = await api("trash:purge");
      await refreshTrash();
      show(`Emptied the trash — ${removed} ${removed === 1 ? "doc" : "docs"} gone for good`);
    } catch (e) {
      show(errorMessage(e));
    } finally {
      setState((s) => ({ ...s, busy: null }));
    }
  }, [refreshTrash, show]);

  const signOut = useCallback(async () => {
    setState((s) => ({ ...s, busy: "signOut" }));
    try {
      await api("auth:signOut");
      useApp.setState({ auth: await api("auth:state") });
    } finally {
      setState((s) => ({ ...s, busy: null }));
    }
  }, []);

  return {
    ...state,
    config,
    auth,
    docCount: index?.docs.length ?? 0,
    trashCount: trash.length,
    projectNames: new Map((index?.projects ?? []).map((p) => [p.slug, p.name])),
    update,
    forgetAssetDir,
    emptyTrash,
    signOut,
    back: () => (window.location.hash = "main"),
    reset: () => void api("app:reset"),
  };
}
