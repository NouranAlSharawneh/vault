import type {
  ConflictPair,
  DocContent,
  SaveRequest,
  SaveResult,
  SyncStatus,
  TrashedDoc,
  VaultConfig,
} from "@shared/types";
import type { GitService } from "../git/git.service";
import type { IndexerService } from "../indexer/indexer.service";

export type TokenProvider = () => string | null;

export interface VaultEvents {
  index: unknown;
  progress: unknown;
  sync: unknown;
  "auth-expired": void;
}

/**
 * What the sync engine needs from the vault, and nothing more: the repo, the index, the
 * config (by reference — it is mutated in place when settings change), somewhere to
 * announce a change, and the one question it has to ask the document layer.
 */
export interface SyncHost {
  readonly config: VaultConfig;
  readonly root: string;
  readonly git: GitService;
  readonly index: IndexerService;
  emit(event: string, payload?: unknown): boolean;
  conflicts(): Promise<ConflictPair[]>;
}

/**
 * What the document-layer modules (trash, projects) need from the vault: the repo, the
 * index, the two side effects every write has (regenerate the README, schedule a push)
 * and the name-collision rule. Split out so those modules are plain functions over a
 * context rather than more methods on VaultService.
 */
export interface VaultContext {
  readonly root: string;
  readonly git: GitService;
  readonly index: IndexerService;
  emit(event: string, payload?: unknown): boolean;
  schedulePush(): void;
  /** Regenerate the README when it is Marasca's own; true when it was written. */
  writeReadme(): Promise<boolean>;
  uniquePath(wanted: string, keep?: string): string;
}

/** What settling a conflict needs: the document layer itself, plus a status refresh. */
export interface ConflictHost {
  readonly index: IndexerService;
  read(relPath: string): Promise<DocContent>;
  /** `moveTo`: the path the text should end up at — the original's, when GitHub's copy
   *  wins. Main-side only; a request from the renderer never names its own path. */
  save(req: SaveRequest, moveTo?: string): Promise<SaveResult>;
  trash(relPath: string): Promise<TrashedDoc>;
  /** Undo a trash that a failed resolution already made. */
  restoreFromTrash(path: string): Promise<SaveResult>;
  refreshSyncStatus(): Promise<SyncStatus>;
}

/** A document a save is about to overwrite, and what the save carries over from it. */
export interface ExistingDoc {
  /** The file as it reads now; null when there is none yet. */
  before: string | null;
  created: string | undefined;
  /** Frontmatter keys Marasca doesn't own, kept as they were. */
  extra: Record<string, unknown>;
  /** The file's own star, when it changed after the editor loaded it; else undefined. */
  starred: boolean | undefined;
}
