export type TrayAction =
  "capture" | "openMain" | "newDocument" | "pushNow" | "rescan" | "openOnGitHub";
export type TrayEnabledWhen = "always" | "vault" | "remote";

export type TrayItemData =
  | { type: "separator" }
  | { role: "quit"; label: string }
  | { label: string; accelerator?: string; action: TrayAction; enabledWhen: TrayEnabledWhen };
