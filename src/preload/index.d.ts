import type { MarascaApi } from "../shared/ipc";

declare global {
  interface Window {
    marasca: MarascaApi;
  }
}

export {};
