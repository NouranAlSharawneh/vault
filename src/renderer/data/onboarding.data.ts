import { CAPTURE_HOTKEY_LABEL, MOD_KEY } from "@/constants";
import type { FeatureData, ScopeData, ShortcutData } from "@/features/onboarding/onboarding.types";

/** Welcome screen: the three things Marasca does. */
export const WELCOME_FEATURES: FeatureData[] = [
  { shortcut: CAPTURE_HOTKEY_LABEL, description: "Capture the clipboard from any app." },
  { shortcut: `${MOD_KEY} K`, description: "Find anything you've saved." },
  { shortcut: "git log", description: "Every save is a commit. History is free." },
];

/** Permissions screen: what GitHub will ask you to approve. */
export const GITHUB_SCOPES: ScopeData[] = [
  {
    granted: true,
    title: "Read and write your repositories",
    description:
      "GitHub's OAuth scope covers all your repos; Marasca only ever touches the one you pick next. Paste a fine-grained token instead if you want it narrowed to that repo.",
  },
  {
    granted: true,
    title: "Push commits to its default branch",
    description: "Each saved document is one commit on main.",
  },
  {
    granted: false,
    title: "Never: your other repos, your org, your profile",
    description: "Nothing leaves your machine except commits to the vault repo.",
  },
];

/** Done screen: the two shortcuts worth learning. */
export const LEARN_SHORTCUTS: ShortcutData[] = [
  { keys: CAPTURE_HOTKEY_LABEL, description: "Copy markdown anywhere, press this, and save it." },
  { keys: `${MOD_KEY} K`, description: "Find anything you've saved." },
];

export const NEW_REPO_PATH = "new";
export const TOKEN_SETTINGS_PATH = "settings/personal-access-tokens/new";
export const DEVICE_LOGIN_PATH = "login/device";
