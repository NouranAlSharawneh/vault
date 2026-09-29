import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { is } from "@electron-toolkit/utils";
import { shell, type WebContents } from "electron";
import { fire } from "../lib/fire";

/** Web pages and mail drafts. Anything else — `file:`, a custom scheme — can launch an app. */
export function isSafeExternal(url: string): boolean {
  return /^(?:https?:\/\/|mailto:)/i.test(url);
}

/** The page every window loads: the dev server in development, the bundled file otherwise. */
function appPage(): string {
  return is.dev && process.env.ELECTRON_RENDERER_URL
    ? new URL(process.env.ELECTRON_RENDERER_URL).origin
    : pathToFileURL(join(__dirname, "../renderer/index.html")).href;
}

/** True for the app's own page, whatever route its hash holds. */
export function isAppUrl(url: string): boolean {
  try {
    const page = appPage();

    return page.startsWith("file:") ? url.split(/[?#]/)[0] === page : new URL(url).origin === page;
  } catch {
    return false;
  }
}

/**
 * Keep a window on the app. Chromium's answer to a file dropped on a page that doesn't
 * take it is to navigate there: the window showed the raw file, kept its preload — so
 * whatever had loaded could reach the whole IPC surface — and the capture sheet, which is
 * never destroyed, stayed that way until quit. Links that try to open a window go to the
 * browser, and only web and mail links go anywhere at all.
 */
export function hardenWebContents(contents: WebContents): void {
  contents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url)) e.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) fire(shell.openExternal(url), "opening a link");

    return { action: "deny" };
  });
}
