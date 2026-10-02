// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_ACTION_MS, TOAST_MAX, TOAST_MS, TOAST_RESUME_MS } from "@/constants";
import { useToast } from "@/stores/toast";

const messages = () => useToast.getState().toasts.map((t) => t.message);
const undo = { label: "Undo", run: vi.fn() };

describe("toast store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    useToast.getState().dismiss();
    vi.useRealTimers();
  });

  it("keeps two messages up at once", () => {
    const { show } = useToast.getState();
    show("Saved");
    show("Couldn’t push");
    expect(messages()).toEqual(["Saved", "Couldn’t push"]);
    expect(useToast.getState().announced?.message).toBe("Couldn’t push");
  });

  it("drops the oldest when full", () => {
    const { show } = useToast.getState();
    for (let i = 1; i <= TOAST_MAX + 1; i++) show(`m${i}`);
    expect(messages()).toHaveLength(TOAST_MAX);
    expect(messages()[0]).toBe("m2");
  });

  it("does not let plain toasts push out an Undo", () => {
    const { show } = useToast.getState();
    show("Moved “Spec” to trash", undo);
    for (let i = 1; i <= TOAST_MAX + 2; i++) show(`failure ${i}`);
    expect(messages()).toHaveLength(TOAST_MAX);
    expect(messages()[0]).toBe("Moved “Spec” to trash");
  });

  it("expires each toast on its own clock, and an Undo lasts longer", () => {
    const { show } = useToast.getState();
    show("Moved “Spec” to trash", undo);
    vi.advanceTimersByTime(1000);
    show("Saved");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(messages()).toEqual(["Moved “Spec” to trash", "Saved"]);
    vi.advanceTimersByTime(1);
    expect(messages()).toEqual(["Moved “Spec” to trash"]);
    // The newest one went; the region is cleared rather than rolled back to an older one.
    expect(useToast.getState().announced).toBeNull();
    vi.advanceTimersByTime(TOAST_ACTION_MS - TOAST_MS - 1000);
    expect(messages()).toEqual([]);
    expect(TOAST_ACTION_MS).toBeGreaterThanOrEqual(10000);
  });

  it("dismisses one toast by id without touching the rest", () => {
    const { show, dismiss } = useToast.getState();
    const a = show("a");
    show("b");
    dismiss(a);
    expect(messages()).toEqual(["b"]);
    // Its timer went with it: nothing fires later against a toast that is gone.
    vi.advanceTimersByTime(TOAST_MS);
    expect(messages()).toEqual([]);
  });
});

describe("a toast being read", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    useToast.getState().dismiss();
    vi.useRealTimers();
  });

  it("waits while the pointer or focus is on it, then gets time to finish", () => {
    const { show, hold, release } = useToast.getState();
    show("Couldn’t push: the network is offline");
    vi.advanceTimersByTime(TOAST_MS - 100);
    hold();
    vi.advanceTimersByTime(60_000);
    expect(messages()).toEqual(["Couldn’t push: the network is offline"]);
    release();
    // 100ms were left; it gets the resume allowance instead of vanishing at once.
    vi.advanceTimersByTime(TOAST_RESUME_MS - 1);
    expect(messages()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(messages()).toEqual([]);
  });

  it("lets the others run again once one is dismissed by hand", () => {
    // The dismissed toast was under the pointer and may never report that it left.
    const { show, hold, dismiss } = useToast.getState();
    const first = show("one");
    show("two");
    hold();
    dismiss(first);
    vi.advanceTimersByTime(TOAST_MS);
    expect(messages()).toEqual([]);
  });
});
