import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DEVICE_FLOW_STATUS_TEXT } from "@/data/auth.data";
import { DeviceFlow } from "@/features/onboarding/components/device-flow/device-flow.component";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const session = {
  userCode: "WDJB-MJRK",
  verificationUri: "https://github.com/login/device",
  expiresIn: 899,
  interval: 5,
};

describe("DeviceFlow — rejection states", () => {
  it.each(["denied", "expired"] as const)("%s → terminal text and Try again", async (status) => {
    const { emit } = mockMarascaApi({ "auth:deviceStart": session });
    render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W"); // code rendered
    act(() => emit("auth:deviceStatus", { status }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT[status])).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("error (main lost GitHub mid-poll) stops waiting and offers Try again", async () => {
    const { emit } = mockMarascaApi({ "auth:deviceStart": session });
    const { container } = render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    act(() => emit("auth:deviceStatus", { status: "error" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.error)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(container.querySelector(".animate-spin-fast")).toBeNull();
  });

  it("ok keeps a spinner while the account is looked up — approved is not signed in yet", async () => {
    // With the spinner gone and nothing after it, a failed lookup left "Approved!" on
    // screen for good.
    const { emit } = mockMarascaApi({ "auth:deviceStart": session });
    const { container } = render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    act(() => emit("auth:deviceStatus", { status: "ok" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.ok)).toBeTruthy();
    expect(container.querySelector(".animate-spin-fast")).not.toBeNull();
  });

  it("slow_down keeps waiting (not a failure)", async () => {
    const { emit } = mockMarascaApi({ "auth:deviceStart": session });
    render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    act(() => emit("auth:deviceStatus", { status: "slow_down" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.slow_down)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use another method" })).toBeTruthy();
  });
});

describe("DeviceFlow — a way out of every state", () => {
  it("while asking for a code: one way out, Use another method", async () => {
    // Cancel and "Use another method" did the same thing; one of them is enough.
    mockMarascaApi({ "auth:deviceStart": () => new Promise(() => undefined) });
    const onBack = vi.fn();
    render(<DeviceFlow onBack={onBack} />);
    expect(await screen.findByText("Asking GitHub for a code…")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Use another method" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("when no code comes back: the reason, Try again and Use another method", async () => {
    const reason = "No GitHub OAuth client ID configured. Paste a token instead.";
    let fail = true;
    const { invoke } = mockMarascaApi({
      "auth:deviceStart": () => {
        if (fail)
          throw new Error(`Error invoking remote method 'auth:deviceStart': Error: ${reason}`);

        return session;
      },
    });
    const onBack = vi.fn();
    render(<DeviceFlow onBack={onBack} />);
    expect(await screen.findByText(reason)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Use another method" }));
    expect(onBack).toHaveBeenCalledOnce();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("W")).toBeTruthy();
    expect(invoke.mock.calls.filter(([c]) => c === "auth:deviceStart")).toHaveLength(2);
  });

  it("with a code on screen: Use another method is still there", async () => {
    mockMarascaApi({ "auth:deviceStart": session });
    render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    expect(screen.getByRole("button", { name: "Use another method" })).toBeTruthy();
  });
});

describe("DeviceFlow — the code", () => {
  const letters = (container: HTMLElement) =>
    [...container.querySelectorAll(".font-mono.text-2xl")].map((el) => ({
      c: el.textContent,
      gap: el.classList.contains("ml-3"),
    }));

  it("drops every hyphen and puts the gap where each one was", async () => {
    mockMarascaApi({ "auth:deviceStart": { ...session, userCode: "AB-CDE-F" } });
    const { container } = render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("A");
    expect(letters(container)).toEqual([
      { c: "A", gap: false },
      { c: "B", gap: false },
      { c: "C", gap: true },
      { c: "D", gap: false },
      { c: "E", gap: false },
      { c: "F", gap: true },
    ]);
  });
});
