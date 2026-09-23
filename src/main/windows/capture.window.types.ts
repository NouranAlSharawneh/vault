/**
 * Why the sheet is going away.
 * - `dismiss`: the user is done with it here (Esc, ⌘↵, or the hotkey again).
 * - `blur`: the user already clicked into something else.
 * - `handoff`: Vault takes over (⌥⌘↵ reveal, or "Open in editor").
 */
export type CaptureHideReason = "dismiss" | "blur" | "handoff";

export interface HideAppInput {
  reason: CaptureHideReason;
  /** No Vault window had focus when the hotkey fired: another app was in front. */
  summonedFromAnotherApp: boolean;
  /** A main or editor window is still open. */
  otherWindows: boolean;
}
