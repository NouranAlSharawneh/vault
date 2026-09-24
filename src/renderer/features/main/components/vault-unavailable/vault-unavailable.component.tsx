import { useEffect, useState } from "react";
import { GitNotice } from "@/components/git-notice/git-notice.component";
import { Button, Empty } from "@/components/ui";
import { shortPath } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { GIT_NOT_READY } from "@shared/constants";

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
  const gitStatus = useApp((s) => s.gitStatus);
  const gitReady = gitStatus?.state === "ready";
  const blockedOnGit = !!vaultError?.includes(GIT_NOT_READY);

  // Git came back (the installer finished, or the user fixed it in Terminal and clicked
  // Check again): open the vault without making them ask twice.
  useEffect(() => {
    if (config && blockedOnGit && gitReady) fire(reopenVault(), "Couldn’t open the vault");
  }, [config, blockedOnGit, gitReady, reopenVault]);

  if (!config) {
    return (
      <Empty
        title="No vault connected"
        action={
          <Button variant="primary" onClick={() => (window.location.hash = "onboarding")}>
            Set up Marasca
          </Button>
        }
      />
    );
  }

  if (blockedOnGit && !gitReady) {
    return (
      <Empty
        title="Marasca needs git to open your vault"
        hint={`Your documents are still in ${shortPath(config.root)}. The vault opens again by itself once git works.`}
        action={
          <div className="flex max-w-md flex-col items-center gap-3">
            <GitNotice />
            <Button
              onClick={() => fire(api("vault:revealInFinder"), "Couldn’t show the vault in Finder")}
            >
              Reveal in Finder
            </Button>
          </div>
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
      title={`Marasca couldn’t open ${shortPath(config.root)}.`}
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
