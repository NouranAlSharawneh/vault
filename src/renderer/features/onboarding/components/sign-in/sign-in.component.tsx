import { useState } from "react";
import { ArrowRight, KeyRound, Smartphone } from "lucide-react";
import { Button, Card, GitHubMark } from "@/components/ui";
import { GITHUB_SCOPES } from "@/data/onboarding.data";
import { ScopeItem } from "../scope-item/scope-item.component";
import { TokenForm } from "../token-form/token-form.component";
import { DeviceFlow } from "../device-flow/device-flow.component";
import { WebFlow } from "../web-flow/web-flow.component";
import { useAuthMethods } from "./hooks/use-auth-methods.hook";
import type { SignInMode, SignInProps } from "./sign-in.types";

/** Permissions explainer, then: browser authorize (primary) · device code · paste a token. */
export function SignIn({ onBack, onLocal }: SignInProps) {
  const [mode, setMode] = useState<SignInMode>("choose");
  const methods = useAuthMethods();
  const back = () => setMode("choose");

  if (mode === "web") return <WebFlow onBack={back} />;
  if (mode === "token") return <TokenForm onBack={back} />;
  if (mode === "device") return <DeviceFlow onBack={back} />;

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">
        What GitHub will ask you to approve
      </h2>
      <p className="mt-1.5 text-sm text-ink-3">
        No password is ever typed into this app. You approve once on github.com; the token lives in
        your macOS Keychain and is never written to the repo.
      </p>
      <ul className="mt-5 space-y-2">
        {GITHUB_SCOPES.map((s) => (
          <ScopeItem key={s.title} {...s} />
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        {methods.oauth ? (
          <Button
            variant="primary"
            className="h-9 justify-center text-base"
            onClick={() => setMode("web")}
          >
            <GitHubMark size={14} /> Continue with GitHub <ArrowRight size={13} />
          </Button>
        ) : (
          <Button
            variant="primary"
            className="h-9 justify-center text-base"
            onClick={() => setMode("token")}
          >
            <KeyRound size={14} /> Paste a token <ArrowRight size={13} />
          </Button>
        )}
        <div className="flex items-center justify-center gap-4 text-xs text-ink-3">
          {methods.device && (
            <button
              className="inline-flex items-center gap-1 hover:text-ink"
              onClick={() => setMode("device")}
            >
              <Smartphone size={11} /> Use a device code
            </button>
          )}
          {methods.oauth && (
            <button
              className="inline-flex items-center gap-1 hover:text-ink"
              onClick={() => setMode("token")}
            >
              <KeyRound size={11} /> Paste a token instead
            </button>
          )}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <button className="text-xs text-ink-4 hover:text-ink-2" onClick={onBack}>
          Back
        </button>
        <Button variant="outline" onClick={onLocal}>
          Skip for now
        </Button>
      </div>
    </Card>
  );
}
