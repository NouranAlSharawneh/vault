import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_UNTITLED_DRAFT_KEY, UNTITLED_DRAFT_PREFIX } from "@shared/constants";
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

function hashKey(key: string): string {
  return createHash("sha1").update(key).digest("hex");
}

/** One file per editor target. A path is hashed so it cannot escape the folder. */
function draftPath(key: string): string {
  return join(draftsDir(), `${hashKey(key)}.json`);
}

function readDraftFile(file: string): StoredDraft | null {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as StoredDraft;

    return typeof raw?.body === "string" ? raw : null;
  } catch {
    return null;
  }
}

/** The key is written into the file as well, since the file name is only its hash. */
export function saveDraft(key: string, draft: StoredDraft): void {
  try {
    writeFileSync(draftPath(key), JSON.stringify({ ...draft, key }), "utf8");
  } catch {
    /* a draft that cannot be parked is not worth failing a keystroke over */
  }
}

export function loadDraft(key: string): StoredDraft | null {
  return readDraftFile(draftPath(key));
}

export function clearDraft(key: string): void {
  rmSync(draftPath(key), { force: true });
}

/** A key no other untitled window has, so each one parks its text on its own. */
export function newUntitledDraftKey(): string {
  return `${UNTITLED_DRAFT_PREFIX}${randomUUID()}`;
}

/**
 * The newest untitled draft with text that no open window is writing to: what was left
 * behind by a crash, a quit or a closed window. A new window takes it over, so the text
 * comes back the way it did when every new window shared one draft.
 */
export function findOrphanedUntitledDraft(held: ReadonlySet<string>): string | null {
  const dir = draftsDir();
  // Drafts from before keys were recorded only ever had one untitled key.
  const legacyFile = `${hashKey(LEGACY_UNTITLED_DRAFT_KEY)}.json`;
  let best: { key: string; at: string } | null = null;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const draft = readDraftFile(join(dir, file));
    const key = draft?.key ?? (file === legacyFile ? LEGACY_UNTITLED_DRAFT_KEY : null);
    if (!draft || !key || held.has(key) || !draft.body.trim()) continue;
    if (key !== LEGACY_UNTITLED_DRAFT_KEY && !key.startsWith(UNTITLED_DRAFT_PREFIX)) continue;
    if (!best || draft.at > best.at) best = { key, at: draft.at };
  }

  return best?.key ?? null;
}
