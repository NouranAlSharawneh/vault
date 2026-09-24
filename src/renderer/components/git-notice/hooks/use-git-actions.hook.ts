import { useState } from "react";
import type { GitAction } from "@/helpers/describe-git.types";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { XCODE_LICENSE_COMMAND } from "@shared/constants";
import type { GitStatus } from "@shared/types";

/** Carry out a git notice action; the new status lands in the store as main reports it. */
export function useGitActions() {
  const status = useApp((s) => s.gitStatus);
  const [busy, setBusy] = useState<GitAction | null>(null);
  const [copied, setCopied] = useState(false);

  const settle = (action: GitAction, call: Promise<GitStatus | null>, whenItFails: string) => {
    setBusy(action);
    fire(
      call
        .then((next) => next && useApp.setState({ gitStatus: next }))
        .finally(() => setBusy(null)),
      whenItFails,
    );
  };

  const run = (action: GitAction) => {
    switch (action) {
      case "install":
      case "reinstall":
      case "reopenInstaller":
        return settle(action, api("git:installTools"), "Couldn’t open Apple’s installer");
      case "recheck":
        return settle(action, api("git:recheck"), "Couldn’t check for git");
      case "choose":
        return settle(action, api("git:choosePath"), "Couldn’t use that git");
      case "useDetected":
        return settle(action, api("git:clearPath"), "Couldn’t look for git");
      case "copy":
        return fire(
          navigator.clipboard.writeText(XCODE_LICENSE_COMMAND).then(() => setCopied(true)),
          "Couldn’t copy the command",
        );
    }
  };

  return { status, busy, copied, run };
}
