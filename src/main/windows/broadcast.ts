import { BrowserWindow } from "electron";
import type { EventChannel, IpcEvents } from "@shared/ipc";

/** Push an event to every open renderer. */
export function broadcast<C extends EventChannel>(channel: C, payload: IpcEvents[C]): void {
  for (const w of BrowserWindow.getAllWindows())
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
}
