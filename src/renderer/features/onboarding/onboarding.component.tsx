import { useEffect, useRef, useState } from "react";
import { Button, Dot, Spinner } from "@/components/ui";
import { isEditableTarget } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { Done } from "./components/done/done.component";
import { FirstScan } from "./components/first-scan/first-scan.component";
import { RepoPicker } from "./components/repo-picker/repo-picker.component";
import { SignIn } from "./components/sign-in/sign-in.component";
import { StepIndicator } from "./components/step-indicator/step-indicator.component";
import { Welcome } from "./components/welcome/welcome.component";
import { useOnboardingStep } from "./hooks/use-onboarding-step.hook";
import { useStepFocus } from "./hooks/use-step-focus.hook";

/** Five screens, target ninety seconds. Success = one document saved. */
export function Onboarding() {
  const { step, setStep, signedIn, user, auth, hasVault } = useOnboardingStep();
  const stepHost = useRef<HTMLDivElement>(null);
  useStepFocus(step, stepHost);
  const installing = useApp((s) => s.gitStatus?.state === "installing");
  // "Start local" from Welcome: the picker opens on keeping it on this Mac, even when
  // signed in — it used to open on "Create a new private repo".
  const [preferLocal, setPreferLocal] = useState(false);
  // Came here from a vault that already exists (Settings, a banner): there is always a
  // way back to it, so changing your mind doesn't mean finishing the flow.
  const canLeave = hasVault && step !== "scan" && step !== "done";
  const signOutHere = async () => {
    await api("auth:signOut");
    useApp.setState({ auth: await api("auth:state") });
    setStep("signin");
  };
  useEffect(() => {
    if (!canLeave) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isEditableTarget(e.target)) return;
      window.location.hash = "main";
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [canLeave]);

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 pr-4 pl-titlebar drag">
        <div className="flex items-center gap-3">
          {canLeave && (
            <Button
              variant="ghost"
              size="sm"
              className="no-drag"
              onClick={() => (window.location.hash = "main")}
            >
              Cancel
            </Button>
          )}
          <StepIndicator step={step} />
        </div>
        <div className="flex items-center gap-4">
          {/* Welcome shows the whole card; the repo step shows its own; the rest keep the
              install in sight here. */}
          {installing && step !== "welcome" && step !== "repo" && (
            <div className="flex items-center gap-1.5 text-xs text-ink-3" role="status">
              <Spinner className="text-warn-2" /> Installing Apple's tools…
            </div>
          )}
          {/* Signed in only while the session is good: an expired one keeps the account
              name, and this used to say "Signed in" in green on the screen that signs you
              back in. */}
          {user && (
            <div className="flex items-center gap-1.5 text-xs text-ink-3 no-drag">
              {signedIn ? (
                <>
                  <Dot tone="bg-ok" size={6} /> Signed in as {user.login} ·
                  {/* The wrong account — a work login still in the browser — used to mean
                      finishing setup, then finding Sign out in Settings. */}
                  <Button variant="link" className="text-xs" onClick={() => fire(signOutHere())}>
                    Not you? Sign out
                  </Button>
                </>
              ) : auth.status === "expired" ? (
                <>
                  <Dot tone="bg-warn" size={6} /> Session expired · {user.login}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 pb-10">
        <div ref={stepHost} className="mt-8 w-full max-w-130 animate-fade-in" key={step}>
          {step === "welcome" && (
            <Welcome
              onNext={() => {
                setPreferLocal(false);
                setStep(signedIn ? "repo" : "signin");
              }}
              onLocal={() => {
                setPreferLocal(true);
                setStep("repo");
              }}
            />
          )}
          {step === "signin" && (
            <SignIn
              onBack={() => setStep("welcome")}
              onLocal={() => {
                setPreferLocal(true);
                setStep("repo");
              }}
            />
          )}
          {/* Back goes to welcome, not sign-in: signed in, sign-in would bounce straight here. */}
          {step === "repo" && (
            <RepoPicker
              preferLocal={preferLocal}
              onDone={() => setStep("scan")}
              onBack={() => setStep("welcome")}
            />
          )}
          {step === "scan" && (
            <FirstScan onDone={() => setStep("done")} onBack={() => setStep("repo")} />
          )}
          {step === "done" && <Done />}
        </div>
      </div>
    </div>
  );
}
