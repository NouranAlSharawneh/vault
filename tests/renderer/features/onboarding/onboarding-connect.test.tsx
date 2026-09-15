// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOnboardingStep } from "@/features/onboarding/hooks/use-onboarding-step.hook";
import { useApp } from "@/stores/app";
import type { VaultConfig } from "@shared/types";

const config = { root: "/v", remote: null, branch: "main" } as VaultConfig;

const signedIn = () =>
  useApp.setState({ auth: { status: "signed-in", user: null }, config } as never);

beforeEach(() => {
  window.location.hash = "#onboarding";
  useApp.setState({ auth: { status: "signed-out", user: null }, config: null } as never);
});

describe("onboarding step", () => {
  it("takes a finished, local-only vault to the repo picker when asked to connect", () => {
    // The Done screen says GitHub can be connected from Settings later. Until this, a
    // vault with a config always short-circuited to Done, so it could not be — the only
    // route to a repo was Reset, which throws the app's state away.
    signedIn();
    window.location.hash = "#onboarding?connect";
    const { result } = renderHook(() => useOnboardingStep());
    expect(result.current.step).toBe("repo");
  });

  it("still goes straight to done on an ordinary visit", () => {
    signedIn();
    const { result } = renderHook(() => useOnboardingStep());
    expect(result.current.step).toBe("done");
  });

  it("asks a signed-out user to sign in first", () => {
    useApp.setState({ auth: { status: "signed-out", user: null }, config } as never);
    window.location.hash = "#onboarding?connect";
    const { result } = renderHook(() => useOnboardingStep());
    expect(result.current.step).toBe("signin");
  });

  it("clears the intent from the hash so a reload does not repeat it", () => {
    signedIn();
    window.location.hash = "#onboarding?connect";
    renderHook(() => useOnboardingStep());
    expect(window.location.hash).toBe("#onboarding");
  });
});
