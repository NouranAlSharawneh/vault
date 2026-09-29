import type { VaultConfig } from "@shared/types";

/** A setting that can be written from this page. */
export type SettingsField = keyof VaultConfig | "trash" | "signOut";

export interface SettingsState {
  /**
   * Last error from a failed save, and which setting it belongs to. One shared message
   * used to appear under the capture shortcut whatever had failed.
   */
  error: { field: SettingsField; message: string } | null;
  /** Which field is being written, for spinners. */
  busy: SettingsField | null;
}
