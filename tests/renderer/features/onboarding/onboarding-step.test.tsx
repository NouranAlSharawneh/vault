import { renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useOnboardingStep } from "@/features/onboarding/hooks/use-onboarding-step.hook";
import { useApp } from "@/stores/app";
import type { AuthState, VaultConfig } from "@shared/types";

const config = { root: "/v", remote: "nunu/vault2", branch: "main" } as VaultConfig;
const expired: AuthState = { status: "expired", user: null, method: "oauth" };
const signedOut: AuthState = { status: "signed-out", user: null, method: null };

describe("useOnboardingStep", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("goes straight to done when a vault is already connected", () => {
    useApp.setState({ config, auth: expired });
    expect(renderHook(() => useOnboardingStep()).result.current.step).toBe("done");
  });

  it("`#onboarding?signin` forces the sign-in screen even with a vault connected", () => {
    // An expired token is exactly this case: a vault exists, but they must sign in again.
    window.location.hash = "onboarding?signin";
    useApp.setState({ config, auth: expired });
    expect(renderHook(() => useOnboardingStep()).result.current.step).toBe("signin");
    // The flag is consumed, so a later ⌘\ or re-render doesn't strand them on sign-in.
    expect(window.location.hash).toBe("#onboarding");
  });

  it("starts at welcome with no vault and no auth", () => {
    useApp.setState({ config: null, auth: signedOut });
    expect(renderHook(() => useOnboardingStep()).result.current.step).toBe("welcome");
  });
});
