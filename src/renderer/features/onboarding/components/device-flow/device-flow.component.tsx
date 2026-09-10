import { useState } from "react";
import { Copy } from "lucide-react";
import { Button, Card, Spinner } from "@/components/ui";
import { COPIED_FEEDBACK_MS } from "@/constants";
import { DEVICE_FLOW_STATUS_TEXT } from "@/data/auth.data";
import { DEVICE_LOGIN_PATH } from "@/data/onboarding.data";
import { cx } from "@/helpers";
import { api } from "@/lib/api";
import { useDeviceFlow } from "./hooks/use-device-flow.hook";
import type { DeviceFlowProps } from "./device-flow.types";

export function DeviceFlow({ onBack }: DeviceFlowProps) {
  const { session, status, error, secondsLeft, terminal, restart } = useDeviceFlow();
  const [copied, setCopied] = useState(false);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const copy = () => {
    if (!session) return;
    void navigator.clipboard.writeText(session.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <Card className="p-7 text-center">
      <h2 className="font-serif text-2xl font-medium text-ink">Enter this code on GitHub</h2>
      <p className="mt-1 text-sm text-ink-3">
        Your browser should have opened{" "}
        <span className="font-mono">github.com/{DEVICE_LOGIN_PATH}</span>. Paste the code there and
        approve.
      </p>
      {session ? (
        <>
          <div className="mt-6 flex justify-center gap-1.5">
            {session.userCode
              .replace("-", "")
              .split("")
              .map((c, i) => (
                <span
                  key={i}
                  className={cx(
                    "flex h-11 w-9 items-center justify-center rounded-sm border border-line bg-paper-2 font-mono text-2xl text-ink",
                    i === 4 && "ml-3",
                  )}
                >
                  {c}
                </span>
              ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs">
            <Button variant="link" onClick={copy}>
              <Copy size={11} /> {copied ? "Copied" : "Copy code"}
            </Button>
            <Button variant="link" onClick={() => api("github:openInBrowser", DEVICE_LOGIN_PATH)}>
              Reopen browser
            </Button>
            <span className="font-mono text-ink-4">
              expires in {mm}:{ss}
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2 text-xs text-ink-2">
            <span className="flex items-center gap-2">
              {!terminal && <Spinner className="text-cherry" />}
              {DEVICE_FLOW_STATUS_TEXT[status]}
            </span>
            {terminal ? (
              <Button variant="link" onClick={restart}>
                Try again
              </Button>
            ) : (
              <Button variant="subtle" onClick={onBack}>
                Cancel
              </Button>
            )}
          </div>
        </>
      ) : error ? (
        <div className="mt-6 text-sm text-cherry">{error}</div>
      ) : (
        <div className="mt-8 flex justify-center">
          <Spinner className="text-ink-3" />
        </div>
      )}
    </Card>
  );
}
