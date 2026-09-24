import { useState } from "react";
import { Button, Empty } from "@/components/ui";
import { shortPath } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";

/**
 * The library when there is no vault to show: none set up, or one set up that would not
 * open. The second used to render as an empty library under a green badge, which reads
 * as "all your documents are gone".
 */
export function VaultUnavailable() {
  const config = useApp((s) => s.config);
  const vaultError = useApp((s) => s.vaultError);
  const reopenVault = useApp((s) => s.reopenVault);
  const [trying, setTrying] = useState(false);

  if (!config) {
    return (
      <Empty
        title="No vault connected"
        action={
          <Button variant="primary" onClick={() => (window.location.hash = "onboarding")}>
            Set up Vault
          </Button>
        }
      />
    );
  }

  const tryAgain = () => {
    setTrying(true);
    fire(
      reopenVault().finally(() => setTrying(false)),
      "Couldn’t open the vault",
    );
  };

  return (
    <Empty
      title={`Vault couldn’t open ${shortPath(config.root)}.`}
      hint={vaultError ?? undefined}
      action={
        <div className="flex items-center gap-2">
          <Button variant="primary" loading={trying} onClick={tryAgain}>
            Try again
          </Button>
          <Button
            onClick={() => fire(api("vault:revealInFinder"), "Couldn’t show the vault in Finder")}
          >
            Reveal in Finder
          </Button>
          {/* `?connect`: plain onboarding sees a config and goes straight to "done". */}
          <Button onClick={() => (window.location.hash = "onboarding?connect")}>
            Set up again
          </Button>
        </div>
      }
    />
  );
}
