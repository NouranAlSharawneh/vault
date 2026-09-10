import type { InvokeChannel, IpcInvoke } from "@shared/ipc";

/** Implementation of one invoke channel; may be sync or async. */
export type IpcHandler<C extends InvokeChannel> = (
  ...args: Parameters<IpcInvoke[C]>
) => ReturnType<IpcInvoke[C]> | Promise<ReturnType<IpcInvoke[C]>>;
