import type { GitAction } from "@/helpers/describe-git.types";
import type { GitSource } from "@shared/types";

/** Button text for each thing the git notice can offer. */
export const GIT_ACTION_LABELS: Record<GitAction, string> = {
  install: "Install tools",
  reinstall: "Reinstall tools",
  reopenInstaller: "Open the installer again",
  recheck: "Check again",
  choose: "I have git somewhere else…",
  useDetected: "Use the git Marasca finds",
  copy: "Copy",
};

/** Where a working git came from, in words a person recognises. */
export const GIT_SOURCE_LABELS: Record<GitSource, string> = {
  apple: "Apple command line tools",
  homebrew: "Homebrew",
  macports: "MacPorts",
  nix: "Nix",
  shell: "your shell's PATH",
  path: "PATH",
  custom: "chosen in Settings",
};
