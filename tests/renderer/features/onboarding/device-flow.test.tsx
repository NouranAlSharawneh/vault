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

  it("slow_down keeps waiting (not a failure)", async () => {
    const { emit } = mockVaultApi({ "auth:deviceStart": session });
    render(<DeviceFlow onBack={() => undefined} />);
    await screen.findByText("W");
    act(() => emit("auth:deviceStatus", { status: "slow_down" }));
    expect(screen.getByText(DEVICE_FLOW_STATUS_TEXT.slow_down)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
