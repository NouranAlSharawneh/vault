import { ExternalLink } from "lucide-react";
import { Button, Card, Spinner } from "@/components/ui";
import { WEB_FLOW_STATUS_TEXT } from "@/data/auth.data";
import { useWebFlow } from "./hooks/use-web-flow.hook";
import type { WebFlowProps } from "./web-flow.types";

export function WebFlow({ onBack }: WebFlowProps) {
  const { status, message, failed, retry } = useWebFlow();

  return (
    <Card className="p-7 text-center">
      <h2 className="font-serif text-2xl font-medium text-ink">Approve Marasca on GitHub</h2>
      <p className="mt-1 text-sm text-ink-3">
        Your browser opened GitHub's authorize page. Click <b>Authorize</b> there and come back —
        this window finishes on its own.
      </p>
      <div className="mt-6 flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2 text-xs text-ink-2">
        <span className="flex items-center gap-2">
          {!failed && status !== "ok" && <Spinner className="text-cherry" />}
          {WEB_FLOW_STATUS_TEXT[status]}
          {status === "error" && message && <span className="text-ink-4">({message})</span>}
        </span>
        {failed ? (
          <Button variant="link" onClick={retry}>
            Try again
          </Button>
        ) : (
          <Button variant="subtle" onClick={onBack}>
            Cancel
          </Button>
        )}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="ghost" onClick={retry}>
          Reopen browser <ExternalLink size={12} />
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Use another method
        </Button>
      </div>
    </Card>
  );
}
