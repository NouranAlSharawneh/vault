import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node 25+ ships its own global `localStorage`, which is undefined without
// --localstorage-file and shadows the one jsdom provides. Hand jsdom's back.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  }
}

// Unmount rendered trees between tests so `screen` queries never see stale DOM.
afterEach(cleanup);
