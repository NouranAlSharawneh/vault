import type { HideAppInput } from "./capture.window.types";

/**
 * Whether hiding the sheet should also hide Marasca (macOS). That is the only way to hand
 * focus back to the app underneath; otherwise macOS keeps Marasca active and brings its
 * main window forward over the app the clip came from.
 */
export function shouldHideApp({
  reason,
  summonedFromAnotherApp,
  otherWindows,
}: HideAppInput): boolean {
  // Marasca is about to show something; hiding it would undo that.
  if (reason === "handoff") return false;
  // Focus has already gone where the user clicked; don't hide a main window they can see.
  if (reason === "blur") return !otherWindows;

  return summonedFromAnotherApp || !otherWindows;
}
