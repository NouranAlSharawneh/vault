import type { VaultConfig } from "@shared/types";

export interface SettingsState {
  /** Last error from a failed save (e.g. a hotkey the OS refused). */
  error: string | null;
  /** Which field is being written, for spinners. */
  busy: keyof VaultConfig | "trash" | "signOut" | null;
}
