import { vi } from "vitest";
import type { EventChannel, InvokeChannel, IpcEvents } from "@shared/ipc";

type Listener = (payload: unknown) => void;

/**
 * Fake `window.vault` for renderer tests: record invokes, answer them from a table,
 * and let the test push main→renderer events.
 */
export function mockVaultApi(answers: Partial<Record<InvokeChannel, unknown>> = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const invoke = vi.fn(async (channel: InvokeChannel, ..._args: unknown[]) => {
    const a = answers[channel];
    if (a instanceof Error) throw a;
    return typeof a === "function" ? (a as () => unknown)() : a;
  });
  const on = vi.fn((channel: EventChannel, listener: Listener) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(listener);
    return () => listeners.get(channel)!.delete(listener);
  });
  const emit = <C extends EventChannel>(channel: C, payload: IpcEvents[C]) => {
    for (const l of listeners.get(channel) ?? []) l(payload);
  };
  Object.defineProperty(window, "vault", { value: { invoke, on }, configurable: true });
  return { invoke, on, emit };
}
