import { act, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEVICE_FLOW_STATUS_TEXT } from "@/data/auth.data";
import { DeviceFlow } from "@/features/onboarding/components/device-flow/device-flow.component";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const session = {
  userCode: "WDJB-MJRK",
  verificationUri: "https://github.com/login/device",
  expiresIn: 899,
  interval: 5,
};

describe("DeviceFlow — rejection states", () => {
  it.each(["denied", "expired"] as const)("%s → terminal text and Try again", async (status) => {
    const { emit } = mockVaultApi({ "auth:deviceStart": session });
    render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W"); // code rendered
    act(() => emit("auth:deviceStatus", { status }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT[status])).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("error (main lost GitHub mid-poll) stops waiting and offers Try again", async () => {
    const { emit } = mockVaultApi({ "auth:deviceStart": session });
    const { container } = render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    act(() => emit("auth:deviceStatus", { status: "error" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.error)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(container.querySelector(".animate-spin-fast")).toBeNull();
  });

  it("ok stops the spinner", async () => {
    const { emit } = mockVaultApi({ "auth:deviceStart": session });
    const { container } = render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    expect(container.querySelector(".animate-spin-fast")).not.toBeNull();
    act(() => emit("auth:deviceStatus", { status: "ok" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.ok)).toBeTruthy();
    expect(container.querySelector(".animate-spin-fast")).toBeNull();
  });

  it("slow_down keeps waiting (not a failure)", async () => {
    const { emit } = mockVaultApi({ "auth:deviceStart": session });
    render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    act(() => emit("auth:deviceStatus", { status: "slow_down" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.slow_down)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});

describe("DeviceFlow — the code", () => {
  const letters = (container: HTMLElement) =>
    [...container.querySelectorAll(".font-mono.text-2xl")].map((el) => ({
      c: el.textContent,
      gap: el.classList.contains("ml-3"),
    }));

  it("drops every hyphen and puts the gap where each one was", async () => {
    mockVaultApi({ "auth:deviceStart": { ...session, userCode: "AB-CDE-F" } });
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
