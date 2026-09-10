export type OnboardingStep = "welcome" | "signin" | "repo" | "scan" | "done";

export interface FeatureData {
  shortcut: string;
  description: string;
}

export interface ScopeData {
  granted: boolean;
  title: string;
  description: string;
}

export interface ShortcutData {
  keys: string;
  description: string;
}
