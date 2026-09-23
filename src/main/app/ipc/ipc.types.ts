import type { WebContents } from "electron";
import type { InvokeChannel, IpcInvoke } from "@shared/ipc";

/** Implementation of one invoke channel; may be sync or async. */
export type IpcHandler<C extends InvokeChannel> = (
  ...args: Parameters<IpcInvoke[C]>
) => ReturnType<IpcInvoke[C]> | Promise<ReturnType<IpcInvoke[C]>>;

/** The same, for a channel whose answer depends on which window asked. */
export type SenderIpcHandler<C extends InvokeChannel> = (
  sender: WebContents,
  ...args: Parameters<IpcInvoke[C]>
) => ReturnType<IpcInvoke[C]> | Promise<ReturnType<IpcInvoke[C]>>;
