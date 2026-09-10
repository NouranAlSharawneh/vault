import { useState } from "react";
import { useApp } from "@/stores/app";
import type { OnboardingStep } from "../onboarding.types";

/**
 * Picks the starting step from saved state; sign-in is skipped as soon as auth lands.
 * `#onboarding?signin` forces the sign-in screen — someone whose token expired already
 * has a vault, so the usual "config exists → done" rule would strand them on it.
 */
function wantsSignIn(): boolean {
  if (!window.location.hash.includes("?signin")) return false;
  window.history.replaceState(null, "", "#onboarding");
  return true;
}

export function useOnboardingStep() {
  const auth = useApp((s) => s.auth);
  const config = useApp((s) => s.config);
  const signedIn = auth.status === "signed-in";
  const [step, setStep] = useState<OnboardingStep>(() =>
    wantsSignIn() ? "signin" : config ? "done" : signedIn ? "repo" : "welcome",
  );

  // Once auth lands, skip the sign-in screen: to the repo picker, or straight to done if a vault exists.
  const effectiveStep: OnboardingStep =
    step === "signin" && signedIn ? (config ? "done" : "repo") : step;
  return { step: effectiveStep, setStep, signedIn, user: auth.user };
}
