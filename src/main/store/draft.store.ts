import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredDraft } from "@shared/types";
import { userDataDir } from "./user-data-dir";

/**
 * Unsaved editor text, kept outside the vault.
 *
 * It used to live only in React state, so closing the window, quitting or a crash lost
 * whatever had been typed — and the unsaved-changes prompt's Discard was instant and
 * final. These are drafts, not documents: they belong in app data, never in the repo,
 * and they are deleted the moment the text becomes a real save.
 */
function draftsDir(): string {
  const dir = join(userDataDir(), "drafts");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** One file per editor target. A path is hashed so it cannot escape the folder. */
function draftPath(key: string): string {
  return join(draftsDir(), `${createHash("sha1").update(key).digest("hex")}.json`);
}

export function saveDraft(key: string, draft: StoredDraft): void {
  try {
    writeFileSync(draftPath(key), JSON.stringify(draft), "utf8");
  } catch {
    /* a draft that cannot be parked is not worth failing a keystroke over */
  }
}

export function loadDraft(key: string): StoredDraft | null {
  try {
    const raw = JSON.parse(readFileSync(draftPath(key), "utf8")) as StoredDraft;
    return typeof raw?.body === "string" ? raw : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  rmSync(draftPath(key), { force: true });
}
