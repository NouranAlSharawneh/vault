import { Dot } from "@/components/ui";
import { Done } from "./components/done/done.component";
import { FirstScan } from "./components/first-scan/first-scan.component";
import { RepoPicker } from "./components/repo-picker/repo-picker.component";
import { SignIn } from "./components/sign-in/sign-in.component";
import { Welcome } from "./components/welcome/welcome.component";
import { useOnboardingStep } from "./hooks/use-onboarding-step.hook";

/** Five screens, target ninety seconds. Success = one document saved. */
export function Onboarding() {
  const { step, setStep, signedIn, user } = useOnboardingStep();

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="flex h-10 shrink-0 items-center justify-end px-4 drag">
        {user && (
          <div className="flex items-center gap-1.5 text-xs text-ink-3 no-drag">
            <Dot tone="bg-ok" size={6} /> Signed in as {user.login}
          </div>
        )}
      </div>
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 pb-10">
        <div className="mt-8 w-full max-w-130 animate-fade-in" key={step}>
          {step === "welcome" && (
            <Welcome
              onNext={() => setStep(signedIn ? "repo" : "signin")}
              onLocal={() => setStep("repo")}
            />
          )}
          {step === "signin" && (
            <SignIn onBack={() => setStep("welcome")} onLocal={() => setStep("repo")} />
          )}
          {/* Back goes to welcome, not sign-in: signed in, sign-in would bounce straight here. */}
          {step === "repo" && (
            <RepoPicker onDone={() => setStep("scan")} onBack={() => setStep("welcome")} />
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
