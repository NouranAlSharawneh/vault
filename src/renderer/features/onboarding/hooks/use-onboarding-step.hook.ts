import { useState } from "react";
import { useApp } from "@/stores/app";
import type { OnboardingStep } from "../onboarding.types";

/**
 * Picks the starting step from saved state; sign-in is skipped as soon as auth lands.
 *
 * `?signin` forces the sign-in screen — someone whose token expired already has a vault,
 * so the usual "config exists → done" rule would strand them on it. `?connect` goes one
 * further and asks for the repo picker even with a vault already set up: the Done screen
 * promises you can "connect GitHub from Settings whenever you like", and until this
 * existed that was not true — a local-only vault could only reach GitHub through Reset,
 * which throws the app's state away.
 */
function intent(): "signin" | "connect" | null {
  const hash = window.location.hash;
  const asked = hash.includes("?connect") ? "connect" : hash.includes("?signin") ? "signin" : null;
  if (asked) window.history.replaceState(null, "", "#onboarding");
  return asked;
}

export function useOnboardingStep() {
  const auth = useApp((s) => s.auth);
  const config = useApp((s) => s.config);
  const signedIn = auth.status === "signed-in";
  const [asked] = useState(intent);
  const [step, setStep] = useState<OnboardingStep>(() =>
    asked === "connect" && signedIn
      ? "repo"
      : asked
        ? "signin"
        : config
          ? "done"
          : signedIn
            ? "repo"
            : "welcome",
  );

  // Once auth lands, leave the sign-in screen: to the repo picker when there is no vault
  // yet or the user came here to attach one, and otherwise straight to done.
  const effectiveStep: OnboardingStep =
    step === "signin" && signedIn ? (config && asked !== "connect" ? "done" : "repo") : step;
  return { step: effectiveStep, setStep, signedIn, user: auth.user };
}
