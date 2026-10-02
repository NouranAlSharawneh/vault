import { BrowserWindow } from "electron";

/**
 * Close every editor window, letting each ask about unsaved text. False when one of them
 * was kept open.
 */
export async function closeDocumentWindows(): Promise<boolean> {
  const others = BrowserWindow.getAllWindows().filter(
    (w) => !w.isDestroyed() && /#editor/.test(w.webContents.getURL()),
  );
  await Promise.all(
    others.map(
      (w) =>
        new Promise<void>((done) => {
          w.once("closed", () => done());
          // A window that cancels its close stays; give it a moment, then carry on counting.
          setTimeout(done, 1500);
          w.close();
        }),
    ),
  );

  return others.every((w) => w.isDestroyed());
}
