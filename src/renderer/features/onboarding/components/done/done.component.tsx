import { Check, RefreshCw } from "lucide-react";
import { Button, Card, Kbd, SectionLabel } from "@/components/ui";
import { LEARN_SHORTCUTS } from "@/data/onboarding.data";
import { plural } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";

export function Done() {
  const config = useApp((s) => s.config);
  const index = useApp((s) => s.index);
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-cherry-tint text-cherry">
        <Check size={18} strokeWidth={2.5} />
      </div>
      <h2 className="mt-4 font-serif text-3xl font-medium text-ink">Vault connected</h2>
      <p className="mt-1 text-sm text-ink-3">
        {plural(index?.docs.length ?? 0, "document")} indexed.{" "}
        {config?.remote ? (
          <>
            Commits go straight to <span className="font-mono">{config.remote}</span> on{" "}
            <span className="font-mono">{config.branch}</span>.
          </>
        ) : (
          "Local-only for now — connect GitHub from Settings whenever you like."
        )}
      </p>
      <div className="mt-6 rounded-md border border-line bg-paper-2 p-4 text-left">
        <SectionLabel className="mb-3 text-center">Learn one thing</SectionLabel>
        {LEARN_SHORTCUTS.map((s) => (
          <div key={s.keys} className="mt-2 flex items-center gap-3 text-sm text-ink-2 first:mt-0">
            <span className="w-19 shrink-0 text-right">
              <Kbd>{s.keys}</Kbd>
            </span>
            {s.description}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" onClick={() => (window.location.hash = "main")}>
          Open the vault
        </Button>
        <Button variant="primary" onClick={() => api("window:openEditor")}>
          Save my first document
        </Button>
      </div>
      <button
        className="mt-4 inline-flex items-center gap-1 text-xs text-ink-4 hover:text-ink-2"
        onClick={() => api("vault:rescan")}
      >
        <RefreshCw size={10} /> Rescan
      </button>
    </Card>
  );
}
