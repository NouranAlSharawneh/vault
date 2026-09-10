import { ArrowRight } from "lucide-react";
import { Button, Logo } from "@/components/ui";
import { WELCOME_FEATURES } from "@/data/onboarding.data";
import { FeatureItem } from "../feature-item/feature-item.component";
import type { WelcomeProps } from "./welcome.types";

export function Welcome({ onNext, onLocal }: WelcomeProps) {
  return (
    <div className="pt-10">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper-2 text-cherry">
        <Logo size={30} />
      </div>
      <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">Vault</h1>
      <p className="mt-3 max-w-105 text-lg text-ink-2">
        Every markdown file you'd hate to lose, committed straight to a GitHub repo you own. No
        database, no account, no lock-in.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" className="h-9 px-4 text-base" onClick={onNext}>
          Connect GitHub <ArrowRight size={14} />
        </Button>
        <button
          className="text-sm text-ink-3 underline decoration-line-2 underline-offset-4 hover:text-ink"
          onClick={onLocal}
        >
          Start local, connect later
        </button>
      </div>
      <div className="mt-14 grid grid-cols-3 gap-4 text-xs text-ink-3">
        {WELCOME_FEATURES.map((f) => (
          <FeatureItem key={f.shortcut} {...f} />
        ))}
      </div>
    </div>
  );
}
