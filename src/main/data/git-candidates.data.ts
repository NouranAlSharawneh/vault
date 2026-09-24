import type { GitCandidate } from "../services/git/git.types";

/**
 * Where git lives when it didn't come with Apple's tools. Apps opened from Finder get a
 * PATH of `/usr/bin:/bin:/usr/sbin:/sbin`, so none of these are found by name.
 * Checked in order; the first that runs wins.
 */
export const GIT_CANDIDATES: GitCandidate[] = [
  { path: "/opt/homebrew/bin/git", source: "homebrew" },
  { path: "/usr/local/bin/git", source: "homebrew" },
  { path: "/opt/local/bin/git", source: "macports" },
  { path: "~/.nix-profile/bin/git", source: "nix" },
  { path: "/run/current-system/sw/bin/git", source: "nix" },
];
