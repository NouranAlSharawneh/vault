import type { SavedNotice } from "@shared/types";

/**
 * The toast for an editor save, said in the main window because the editor has already
 * closed. It says what actually happened — a save that changed nothing does not get to
 * claim "Saved", and one that only wrote to disk says it is not committed yet.
 */
export function describeSave({ title, outcome, committed, keptOtherVersion }: SavedNotice): string {
  const name = `“${title}”`;
  if (outcome === "unchanged") return `No changes to ${name} — nothing to save`;
  if (keptOtherVersion)
    return `Saved ${name} — it had changed elsewhere, so that version is in its history`;
  const pending = committed ? "" : " — not committed yet";
  if (outcome === "added")
    return committed ? `Added ${name} to the vault` : `Saved ${name}${pending}`;
  if (outcome === "moved") return `Saved ${name} at its new location${pending}`;

  return `Saved changes to ${name}${pending}`;
}
