import { useEffect, useState } from "react";
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
  const [asked, setAsked] = useState(intent);

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

  // Asked again while already here — a banner in another window, say. The route is the
  // same once the `?…` is dropped, so nothing remounted and the request did nothing.
  useEffect(() => {
    const onHash = () => {
      const next = intent();
      if (!next) return;
      setAsked(next);
      setStep(
        next === "connect" && useApp.getState().auth.status === "signed-in" ? "repo" : "signin",
      );
    };
    window.addEventListener("hashchange", onHash);

    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Once auth lands, leave the sign-in screen: to the repo picker when there is no GitHub
  // repo yet or the user came here to attach one, and otherwise on. A local-only vault
  // signing in from Settings wants a repo, not the "your vault is ready" screen.
  const connected = !!config?.remote;
  const effectiveStep: OnboardingStep =
    step === "signin" && signedIn ? (connected && asked !== "connect" ? "done" : "repo") : step;
  // Signing in again to a vault that already pushes somewhere is not a first run: go
  // straight back to the library rather than through the celebration and its tips.
  const backToVault = asked === "signin" && signedIn && connected && effectiveStep === "done";
  useEffect(() => {
    if (backToVault) window.location.hash = "main";
  }, [backToVault]);

  return { step: effectiveStep, setStep, signedIn, user: auth.user, auth, hasVault: !!config };
}
