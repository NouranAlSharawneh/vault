import { Copy } from "lucide-react";
import { useState } from "react";
import { Button, Card, Spinner } from "@/components/ui";
import { COPIED_FEEDBACK_MS } from "@/constants";
import { DEVICE_FLOW_STATUS_TEXT } from "@/data/auth.data";
import { DEVICE_LOGIN_PATH } from "@/data/onboarding.data";
import { cx } from "@/helpers";
import { api, fire } from "@/lib/api";
import type { DeviceFlowProps } from "./device-flow.types";
import { useDeviceFlow } from "./hooks/use-device-flow.hook";

export function DeviceFlow({ onBack }: DeviceFlowProps) {
  const { session, status, error, secondsLeft, terminal, restart } = useDeviceFlow();
  const [copied, setCopied] = useState(false);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const copy = () => {
    if (!session) return;
    // "Copied" only once it is: it used to show even when the clipboard refused.
    fire(
      navigator.clipboard.writeText(session.userCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      }),
      "Couldn’t copy the code",
    );
  };

  return (
    <Card className="p-7 text-center">
      <h2 className="font-serif text-2xl font-medium text-ink">Enter this code on GitHub</h2>
      {/* Only once there is a code: before one arrives, or when none can, the browser
          has opened nothing. */}
      {session && (
        <p className="mt-1.5 text-sm text-ink-3">
          Your browser should have opened{" "}
          <span className="font-mono">github.com/{DEVICE_LOGIN_PATH}</span>. Paste the code there
          and approve.
        </p>
      )}
      {session ? (
        <>
          <div
            className="mt-6 flex justify-center gap-1.5"
            role="img"
            aria-label={`Code ${session.userCode.split("").join(" ")}`}
          >
            {/* The gap goes wherever GitHub put a hyphen, however many there are. */}
            {session.userCode.split("-").map((group, g) =>
              group.split("").map((c, i) => (
                <span
                  key={`${g}-${i}`}
                  aria-hidden
                  className={cx(
                    "flex h-11 w-9 items-center justify-center rounded-sm border border-line bg-paper-2 font-mono text-2xl text-ink",
                    g > 0 && i === 0 && "ml-3",
                  )}
                >
                  {c}
                </span>
              )),
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs">
            <Button variant="link" onClick={copy}>
              <Copy size={12} /> {copied ? "Copied" : "Copy code"}
            </Button>
            <Button
              variant="link"
              onClick={() =>
                fire(api("github:openInBrowser", DEVICE_LOGIN_PATH), "Couldn’t open GitHub")
              }
            >
              Reopen browser
            </Button>
            <span className="font-mono text-ink-4">
              expires in {mm}:{ss}
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2 text-xs text-ink-2">
            <span className="flex items-center gap-2" role="status">
              {/* Approved is not done: the account is still being looked up. */}
              {!terminal && <Spinner className="text-cherry" />}
              {DEVICE_FLOW_STATUS_TEXT[status]}
            </span>
            {terminal && (
              <Button variant="link" onClick={restart}>
                Try again
              </Button>
            )}
          </div>
        </>
      ) : error ? (
        // No code ever came back (no client ID, offline): without these it was a dead end.
        <div className="mt-6 flex items-center justify-between gap-3 rounded-md border border-line bg-paper-2 px-3 py-2 text-left text-xs">
          <span className="text-cherry">{error}</span>
          <Button variant="link" className="shrink-0" onClick={restart}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2 text-xs text-ink-2">
          <span className="flex items-center gap-2" role="status">
            <Spinner className="text-cherry" /> Asking GitHub for a code…
          </span>
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <Button variant="ghost" size="lg" onClick={onBack}>
          Use another method
        </Button>
      </div>
    </Card>
  );
}
