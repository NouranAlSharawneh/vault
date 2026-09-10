import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { GITHUB_SCOPES } from "@/data/onboarding.data";
import { api } from "@/lib/api";
import { ScopeItem } from "../scope-item/scope-item.component";
import { TokenForm } from "../token-form/token-form.component";
import { DeviceFlow } from "../device-flow/device-flow.component";
import type { SignInMode, SignInProps } from "./sign-in.types";

/** Permissions explainer, then either paste-a-token or OAuth device flow. */
export function SignIn({ onBack, onLocal }: SignInProps) {
  const [mode, setMode] = useState<SignInMode>("choose");
  const [deviceAvailable, setDeviceAvailable] = useState(false);

  useEffect(() => {
    void api("auth:deviceAvailable").then(setDeviceAvailable);
  }, []);

  if (mode === "token") return <TokenForm onBack={() => setMode("choose")} />;
  if (mode === "device") return <DeviceFlow onBack={() => setMode("choose")} />;

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">
        What GitHub will ask you to approve
      </h2>
      <p className="mt-1.5 text-sm text-ink-3">
        No password is ever typed into this app and no secret is shipped inside it. The token lives
        in your macOS Keychain.
      </p>
      <ul className="mt-5 space-y-2">
        {GITHUB_SCOPES.map((s) => (
          <ScopeItem key={s.title} {...s} />
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <button className="text-xs text-ink-4 hover:text-ink-2" onClick={onBack}>
          Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onLocal}>
            Skip for now
          </Button>
          {deviceAvailable && (
            <Button variant="outline" onClick={() => setMode("device")}>
              Continue to GitHub <ExternalLink size={12} />
            </Button>
          )}
          <Button variant="primary" onClick={() => setMode("token")}>
            Paste a token <ArrowRight size={13} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
