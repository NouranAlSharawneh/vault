import { ArrowRight, PenLine, RefreshCw } from "lucide-react";
import { GitNotice } from "@/components/git-notice/git-notice.component";
import { Button, Card, Kbd, Logo, SectionLabel } from "@/components/ui";
import { LEARN_SHORTCUTS } from "@/data/onboarding.data";
import { plural } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";

/**
 * The last onboarding screen: what was set up, the two shortcuts worth knowing, and the
 * next step. A vault that already holds documents leads with opening it; an empty one
 * leads with writing the first.
 */
export function Done() {
  const config = useApp((s) => s.config);
  const count = useApp((s) => s.index?.docs.length ?? 0);
  const openVault = () => (window.location.hash = "main");
  const newDocument = () => fire(api("window:openEditor"), "Couldn’t open the editor");

  return (
    <Card className="p-8">
      <Logo size={56} className="mb-5 -ml-1" />
      <h2 className="font-serif text-4xl font-medium text-ink">Your vault is ready</h2>
      <p className="mt-2 text-md text-ink-2">
        {plural(count, "document")} indexed.{" "}
        {config?.remote ? (
          <>
            Every save is a commit to <span className="font-mono">{config.remote}</span> on{" "}
            <span className="font-mono">{config.branch}</span>.
          </>
        ) : (
          "Local-only for now. Connect GitHub from Settings whenever you like."
        )}
      </p>

      <div className="mt-6 rounded-md border border-line bg-paper-2 p-4">
        <SectionLabel className="mb-3">Two shortcuts worth learning</SectionLabel>
        <div className="flex flex-col gap-2.5">
          {LEARN_SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center gap-3 text-sm text-ink-2">
              <span className="w-16 shrink-0">
                <Kbd>{s.keys}</Kbd>
              </span>
              {s.description}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {count > 0 ? (
          <>
            <Button variant="primary" size="lg" onClick={openVault}>
              Open the vault <ArrowRight size={14} />
            </Button>
            <Button variant="outline" size="lg" onClick={newDocument}>
              <PenLine size={14} /> New document
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" onClick={newDocument}>
              <PenLine size={14} /> Save my first document
            </Button>
            <Button variant="outline" size="lg" onClick={openVault}>
              Open the vault
            </Button>
          </>
        )}
      </div>

      <div className="mt-7 flex items-center justify-between gap-4 border-t border-line pt-4">
        <GitNotice />
        <Button
          variant="subtle"
          className="shrink-0"
          onClick={() => fire(api("vault:rescan"), "Couldn’t rescan the vault folder")}
        >
          <RefreshCw size={12} /> Rescan
        </Button>
      </div>
    </Card>
  );
}
