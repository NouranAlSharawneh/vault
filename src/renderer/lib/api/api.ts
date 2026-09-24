import type { MarascaApi } from "@shared/ipc";

/** Typed bridge to the main process (see `src/preload`). */
export const api: MarascaApi["invoke"] = (channel, ...args) =>
  window.marasca.invoke(channel, ...args);
export const on: MarascaApi["on"] = (channel, listener) => window.marasca.on(channel, listener);
