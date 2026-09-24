import { ArrowRight, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button, Card, GitHubMark } from "@/components/ui";
import { GITHUB_SCOPES } from "@/data/onboarding.data";
import { DeviceFlow } from "../device-flow/device-flow.component";
import { ScopeItem } from "../scope-item/scope-item.component";
import { TokenForm } from "../token-form/token-form.component";
import { useAuthMethods } from "./hooks/use-auth-methods.hook";
import type { SignInMode, SignInProps } from "./sign-in.types";

/**
 * Permissions explainer, then: GitHub device code (primary, when an OAuth App client ID is
 * configured) · paste a token. The device flow needs no client secret, so none ships.
 */
export function SignIn({ onBack, onLocal }: SignInProps) {
  const [mode, setMode] = useState<SignInMode>("choose");
  const methods = useAuthMethods();
  const back = () => setMode("choose");

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
        {!methods ? (
          // Holds the primary button's height until main says which one it is.
          <div className="h-9" />
        ) : methods.device ? (
          <Button
            variant="primary"
            size="lg"
            className="justify-center"
            onClick={() => setMode("device")}
          >
            <GitHubMark size={14} /> Continue with GitHub <ArrowRight size={13} />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="justify-center"
            onClick={() => setMode("token")}
          >
            <KeyRound size={14} /> Paste a token <ArrowRight size={13} />
          </Button>
        )}
        {methods?.device && (
          <div className="flex items-center justify-center">
            <Button variant="subtle" onClick={() => setMode("token")}>
              <KeyRound size={11} /> Paste a token instead
            </Button>
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
        <Button variant="outline" onClick={onLocal}>
          Skip for now
        </Button>
      </div>
    </Card>
  );
}
