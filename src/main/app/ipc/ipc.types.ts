import type { BrowserWindow } from "electron";
import type { InvokeChannel, IpcInvoke } from "@shared/ipc";

/** Implementation of one invoke channel; may be sync or async. */
export type IpcHandler<C extends InvokeChannel> = (
  ...args: Parameters<IpcInvoke[C]>
) => ReturnType<IpcInvoke[C]> | Promise<ReturnType<IpcInvoke[C]>>;

/** An invoke handler that also needs the window that sent the request (null if it has none). */
export type IpcSenderHandler<C extends InvokeChannel> = (
  sender: BrowserWindow | null,
  ...args: Parameters<IpcInvoke[C]>
) => ReturnType<IpcInvoke[C]> | Promise<ReturnType<IpcInvoke[C]>>;
