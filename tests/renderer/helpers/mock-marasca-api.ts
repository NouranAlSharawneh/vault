import { vi } from "vitest";
import type { EventChannel, InvokeChannel, IpcEvents } from "@shared/ipc";

type Listener = (payload: unknown) => void;

/**
 * Fake `window.marasca` for renderer tests: record invokes, answer them from a table,
 * and let the test push main→renderer events.
 */
export function mockMarascaApi(answers: Partial<Record<InvokeChannel, unknown>> = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const invoke = vi.fn(async (channel: InvokeChannel, ...args: unknown[]) => {
    const a = answers[channel];
    if (a instanceof Error) throw a;

    // Answers get the call's arguments, so a handler can reply the way main would.
    return typeof a === "function" ? (a as (...a: unknown[]) => unknown)(...args) : a;
  });
  const on = vi.fn((channel: EventChannel, listener: Listener) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(listener);

    return () => listeners.get(channel)!.delete(listener);
  });
  const emit = <C extends EventChannel>(channel: C, payload: IpcEvents[C]) => {
    for (const l of listeners.get(channel) ?? []) l(payload);
  };
  Object.defineProperty(window, "marasca", { value: { invoke, on }, configurable: true });

  return { invoke, on, emit };
}
