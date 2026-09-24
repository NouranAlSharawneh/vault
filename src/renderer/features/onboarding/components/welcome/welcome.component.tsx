import { ArrowRight } from "lucide-react";
import { GitNotice } from "@/components/git-notice/git-notice.component";
import { Button, Logo, Wordmark } from "@/components/ui";
import { WELCOME_FEATURES } from "@/data/onboarding.data";
import { FeatureItem } from "../feature-item/feature-item.component";
import type { WelcomeProps } from "./welcome.types";

export function Welcome({ onNext, onLocal }: WelcomeProps) {
  return (
    <div className="pt-10">
      <Logo size={72} bounce className="mb-5 -ml-1" />
      <h1 className="text-ink">
        <Wordmark height={30} />
      </h1>
      <p className="mt-3 max-w-105 text-lg text-ink-2">
        Every markdown file you'd hate to lose, committed straight to a GitHub repo you own. No
        database, no account, no lock-in.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={onNext}>
          Connect GitHub <ArrowRight size={14} />
        </Button>
        <Button
          variant="subtle"
          className="text-sm underline decoration-line-2 underline-offset-4"
          onClick={onLocal}
        >
          Start local, connect later
        </Button>
      </div>
      {/* Sign-in doesn't need git, so nothing here blocks: an install can run meanwhile. */}
      <GitNotice className="mt-5" />
      <div className="mt-14 grid grid-cols-3 gap-4 text-xs text-ink-3">
        {WELCOME_FEATURES.map((f) => (
          <FeatureItem key={f.shortcut} {...f} />
        ))}
      </div>
    </div>
  );
}
