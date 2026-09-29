import { useEffect, useId, useRef } from "react";
import { Button, Card } from "@/components/ui";
import { NEW_REPO_PATH, TOKEN_SETTINGS_PATH } from "@/data/onboarding.data";
import { api, fire } from "@/lib/api";
import { StepFooter } from "../step-footer/step-footer.component";
import { useTokenSignIn } from "./hooks/use-token-sign-in.hook";
import type { TokenFormProps } from "./token-form.types";

export function TokenForm({ onBack }: TokenFormProps) {
  const { token, setToken, busy, error, submit, canSubmit } = useTokenSignIn();
  const ref = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => ref.current?.focus(), []);

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Paste a fine-grained token</h2>
      {/* The repo comes first: a token scoped to one repo can't create it afterwards. */}
      <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-sm text-ink-2">
        <li>
          Create a private repo for the vault at{" "}
          <Button
            variant="link"
            className="text-sm underline"
            onClick={() => fire(api("github:openInBrowser", NEW_REPO_PATH), "Couldn’t open GitHub")}
          >
            github.com/{NEW_REPO_PATH}
          </Button>
          . The token below can’t create one for you.
        </li>
        <li>
          Open{" "}
          <Button
            variant="link"
            className="text-sm underline"
            onClick={() =>
              fire(api("github:openInBrowser", TOKEN_SETTINGS_PATH), "Couldn’t open GitHub")
            }
          >
            github.com/{TOKEN_SETTINGS_PATH}
          </Button>{" "}
          → Repository access: <b>Only select repositories</b> → that repo.
        </li>
        <li>
          Permissions: <b>Contents · Read and write</b>. GitHub adds Metadata · Read-only on its
          own; everything else stays “No access”.
        </li>
        <li>
          Generate, copy, paste it below. It is stored encrypted and never written to the repo.
        </li>
      </ol>
      <input
        ref={ref}
        type="password"
        className="input mt-6 font-mono text-xs"
        aria-label="GitHub token"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        placeholder="github_pat_…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        spellCheck={false}
      />
      {error && (
        <div id={errorId} role="alert" className="mt-2 text-xs text-cherry">
          {error}
        </div>
      )}
      <StepFooter onBack={onBack}>
        <Button
          variant="primary"
          size="lg"
          loading={busy}
          disabled={!canSubmit}
          onClick={() => fire(submit())}
        >
          Sign in
        </Button>
      </StepFooter>
    </Card>
  );
}
