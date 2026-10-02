import type { AuthMethod, VaultConfig } from "@shared/types";

/** Where a window was last, in screen points. */
export interface SavedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  vault: VaultConfig | null;
  authMethod: AuthMethod | null;
  githubClientId: string | null;
  onboarded: boolean;
  /** A git chosen in Settings; null means detect one. */
  gitPath: string | null;
  /** The main window's place and the last editor's size, from the last run. */
  windowBounds?: { main?: SavedBounds; editor?: SavedBounds };
}
