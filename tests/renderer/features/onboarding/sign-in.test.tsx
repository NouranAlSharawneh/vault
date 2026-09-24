import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SignIn } from "@/features/onboarding/components/sign-in/sign-in.component";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const noop = () => undefined;

describe("SignIn — which methods are offered", () => {
  it("with a client ID configured: GitHub (device code) is primary, token is the fallback", async () => {
    mockMarascaApi({ "auth:methods": { device: true } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Continue with GitHub/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Paste a token instead/ })).toBeTruthy();
  });

  it("with nothing configured: only paste-a-token is offered", async () => {
    mockMarascaApi({ "auth:methods": { device: false } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Paste a token/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue with GitHub/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Paste a token instead/ })).toBeNull();
  });

  it("offers no primary button until main answers, so it never swaps one for another", async () => {
    let answer: (m: { device: boolean }) => void = noop;
    mockMarascaApi({ "auth:methods": () => new Promise((r) => (answer = r)) });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(screen.queryByRole("button", { name: /Paste a token/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue with GitHub/ })).toBeNull();
    act(() => answer({ device: true }));
    expect(await screen.findByRole("button", { name: /Continue with GitHub/ })).toBeTruthy();
  });

  it("falls back to paste-a-token when main can’t say", async () => {
    mockMarascaApi({ "auth:methods": new Error("no handler") });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Paste a token/ })).toBeTruthy();
  });

  it("Continue with GitHub opens the device-code card, never a browser redirect flow", async () => {
    const { invoke } = mockMarascaApi({
      "auth:methods": { device: true },
      "auth:deviceStart": {
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
        expiresIn: 900,
        interval: 5,
      },
    });
    render(<SignIn onBack={noop} onLocal={noop} />);
    await userEvent.click(await screen.findByRole("button", { name: /Continue with GitHub/ }));
    expect(screen.getByText("Enter this code on GitHub")).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("auth:deviceStart");
    expect(invoke.mock.calls.some((c) => String(c[0]).startsWith("auth:web"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /Use another method/ }));
    expect(screen.getByText("What GitHub will ask you to approve")).toBeTruthy();
  });

  it("Paste a token instead opens the token form", async () => {
    mockMarascaApi({ "auth:methods": { device: true } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    await userEvent.click(await screen.findByRole("button", { name: /Paste a token instead/ }));
    expect(screen.getByText("Paste a fine-grained token")).toBeTruthy();
  });
});
