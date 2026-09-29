import { ONBOARDING_STEPS } from "@/data/onboarding.data";
import { cx } from "@/helpers";
import type { OnboardingStep } from "../../onboarding.types";

/**
 * Where you are in setup. Five screens with nothing to say how many were left read as
 * open-ended; the marks show it at a glance, the sentence says it.
 */
export function StepIndicator({ step }: { step: OnboardingStep }) {
  const at = ONBOARDING_STEPS.findIndex((s) => s.step === step);
  if (at < 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">
        Step {at + 1} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[at].name}
      </span>
      {ONBOARDING_STEPS.map((s, i) => (
        <span
          key={s.step}
          aria-hidden
          className={cx(
            "h-1.5 rounded-full transition-all",
            i === at ? "w-4 bg-cherry" : i < at ? "w-1.5 bg-ink-4" : "w-1.5 bg-line-2",
          )}
        />
      ))}
    </div>
  );
}
