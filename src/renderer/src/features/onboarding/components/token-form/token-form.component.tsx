import { useEffect, useRef } from "react";
import { Button, Card } from "@/components/ui";
import { TOKEN_SETTINGS_PATH } from "@/data/onboarding.data";
import { api } from "@/lib/api";
import { useTokenSignIn } from "./hooks/use-token-sign-in.hook";
import type { TokenFormProps } from "./token-form.types";

export function TokenForm({ onBack }: TokenFormProps) {
  const { token, setToken, busy, error, submit, canSubmit } = useTokenSignIn();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Paste a fine-grained token</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-ink-2">
        <li>
          Open{" "}
          <button
            className="text-cherry underline underline-offset-2"
            onClick={() => api("github:openInBrowser", TOKEN_SETTINGS_PATH)}
          >
            github.com/{TOKEN_SETTINGS_PATH}
          </button>
        </li>
        <li>
          Repository access: <b>Only select repositories</b> → your vault repo (create it first if
          you need to).
        </li>
        <li>
          Permissions: <b>Contents · Read and write</b>. Everything else stays “No access”.
        </li>
        <li>
          Generate, copy, paste it below. It is stored encrypted and never written to the repo.
        </li>
      </ol>
      <input
        ref={ref}
        type="password"
        className="input mt-5 font-mono text-xs"
        placeholder="github_pat_…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        spellCheck={false}
      />
      {error && <div className="mt-2 text-xs text-cherry">{error}</div>}
      <div className="mt-5 flex items-center justify-between">
        <button className="text-xs text-ink-4 hover:text-ink-2" onClick={onBack}>
          Back
        </button>
        <Button
          variant="primary"
          loading={busy}
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          Sign in
        </Button>
      </div>
    </Card>
  );
}
