import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// findBy/waitFor give up after 1s by default. CodeMirror-heavy tests run alongside the
// git-backed suites and can take longer than that under load, without anything wrong.
configure({ asyncUtilTimeout: 3000 });

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
