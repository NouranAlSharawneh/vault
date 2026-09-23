import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { WEB_FLOW_STATUS_TEXT } from "@/data/auth.data";
import { WebFlow } from "@/features/onboarding/components/web-flow/web-flow.component";
import { mockVaultApi } from "../../helpers/mock-vault-api";

describe("WebFlow — what the user sees when GitHub says no", () => {
  it("starts the flow on mount and shows the waiting state with a Cancel", () => {
    const { invoke } = mockVaultApi();
    render(<WebFlow onBack={() => undefined} />);
    expect(invoke).toHaveBeenCalledWith("auth:webStart");
    expect(screen.getByText(WEB_FLOW_STATUS_TEXT.waiting)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it.each([
    ["denied", "access_denied"],
    ["timeout", "timeout"],
    ["error", "bad_verification_code"],
  ] as const)("%s → explains it and offers Try again", async (status, message) => {
    const { emit, invoke } = mockVaultApi();
    render(<WebFlow onBack={() => undefined} />);
    act(() => emit("auth:webStatus", { status, message }));
    expect(screen.getByText(WEB_FLOW_STATUS_TEXT[status])).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    // a retry cancels the old listener and starts a fresh one
    expect(invoke).toHaveBeenCalledWith("auth:webCancel");
    expect(invoke.mock.calls.filter((c) => c[0] === "auth:webStart")).toHaveLength(2);
    expect(screen.getByText(WEB_FLOW_STATUS_TEXT.waiting)).toBeTruthy();
  });

  it("shows the raw reason for unexpected errors but not for known ones", () => {
    const { emit } = mockVaultApi();
    render(<WebFlow onBack={() => undefined} />);
    act(() => emit("auth:webStatus", { status: "error", message: "state mismatch" }));
    expect(screen.getByText("(state mismatch)")).toBeTruthy();
    act(() => emit("auth:webStatus", { status: "denied", message: "access_denied" }));
    expect(screen.queryByText("(access_denied)")).toBeNull();
  });

  it("surfaces a failure to even start (e.g. no OAuth App configured)", async () => {
    mockVaultApi({
      "auth:webStart": new Error("No GitHub OAuth App configured. See .env.example."),
    });
    render(<WebFlow onBack={() => undefined} />);
    expect(
      await screen.findByText("(No GitHub OAuth App configured. See .env.example.)"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("Cancel goes back and unmounting tells main to stop listening", async () => {
    const onBack = vi.fn();
    const { invoke } = mockVaultApi();
    const { unmount } = render(<WebFlow onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onBack).toHaveBeenCalled();
    unmount();
    expect(invoke).toHaveBeenCalledWith("auth:webCancel");
  });
});
