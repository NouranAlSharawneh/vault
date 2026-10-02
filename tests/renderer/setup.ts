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

// jsdom lays nothing out, so it has no scrollIntoView; lists that keep their selection in
// view call it on every move.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// Unmount rendered trees between tests so `screen` queries never see stale DOM.
afterEach(cleanup);

// The library remembers its selection and scroll across launches; one test's must not
// become the next one's launch state.
afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage in this environment */
  }
});
