import { useState } from "react";
import { useApp } from "@/stores/app";
import type { OnboardingStep } from "../onboarding.types";

/** Picks the starting step from saved state; sign-in is skipped as soon as auth lands. */
export function useOnboardingStep() {
  const auth = useApp((s) => s.auth);
  const config = useApp((s) => s.config);
  const signedIn = auth.status === "signed-in";
  const [step, setStep] = useState<OnboardingStep>(() =>
    config ? "done" : signedIn ? "repo" : "welcome",
  );

  const effectiveStep: OnboardingStep = step === "signin" && signedIn ? "repo" : step;
  return { step: effectiveStep, setStep, signedIn, user: auth.user };
}
