import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SignIn } from "@/features/onboarding/components/sign-in/sign-in.component";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const noop = () => undefined;

describe("SignIn — which methods are offered", () => {
  it("with an OAuth App configured: GitHub is primary, device code and token are fallbacks", async () => {
    mockVaultApi({ "auth:methods": { oauth: true, device: true } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Continue with GitHub/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Use a device code/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Paste a token instead/ })).toBeTruthy();
  });

  it("with nothing configured: only paste-a-token is offered", async () => {
    mockVaultApi({ "auth:methods": { oauth: false, device: false } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Paste a token/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue with GitHub/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /device code/ })).toBeNull();
  });

  it("with only a client ID (no secret): device code offered, no web flow", async () => {
    mockVaultApi({ "auth:methods": { oauth: false, device: true } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Use a device code/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue with GitHub/ })).toBeNull();
  });

  it("offers no primary button until main answers, so it never swaps one for another", async () => {
    let answer: (m: { oauth: boolean; device: boolean }) => void = noop;
    mockVaultApi({ "auth:methods": () => new Promise((r) => (answer = r)) });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(screen.queryByRole("button", { name: /Paste a token/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue with GitHub/ })).toBeNull();
    act(() => answer({ oauth: true, device: false }));
    expect(await screen.findByRole("button", { name: /Continue with GitHub/ })).toBeTruthy();
  });

  it("falls back to paste-a-token when main can’t say", async () => {
    mockVaultApi({ "auth:methods": new Error("no handler") });
    render(<SignIn onBack={noop} onLocal={noop} />);
    expect(await screen.findByRole("button", { name: /Paste a token/ })).toBeTruthy();
  });

  it("Continue with GitHub opens the web-flow card; Use another method returns", async () => {
    mockVaultApi({ "auth:methods": { oauth: true, device: false } });
    render(<SignIn onBack={noop} onLocal={noop} />);
    await userEvent.click(await screen.findByRole("button", { name: /Continue with GitHub/ }));
    expect(screen.getByText("Approve Vault on GitHub")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Use another method/ }));
    expect(screen.getByText("What GitHub will ask you to approve")).toBeTruthy();
  });
});
