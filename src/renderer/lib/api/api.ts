import type { VaultApi } from "@shared/ipc";

/** Typed bridge to the main process (see `src/preload`). */
export const api: VaultApi["invoke"] = (channel, ...args) => window.vault.invoke(channel, ...args);
export const on: VaultApi["on"] = (channel, listener) => window.vault.on(channel, listener);
