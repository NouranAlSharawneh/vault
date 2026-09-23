import type {
  AuthState,
  IndexSnapshot,
  ScanProgress,
  SyncStatus,
  TrashedDoc,
  VaultConfig,
} from "@shared/types";

export interface AppState {
  ready: boolean;
  auth: AuthState;
  config: VaultConfig | null;
  index: IndexSnapshot | null;
  /**
   * Why the configured vault couldn't be opened, or null. Without it a vault that failed
   * to open looked exactly like an empty one.
   */
  vaultError: string | null;
  progress: ScanProgress;
  sync: SyncStatus | null;
  /** Contents of `.trash/`; refreshed with the index and after trash actions. */
  trash: TrashedDoc[];
  platform: string;
  boot: () => Promise<void>;
  /** Ask main to open the configured vault again, then load it as boot would. */
  reopenVault: () => Promise<void>;
  refreshIndex: () => Promise<void>;
  refreshTrash: () => Promise<void>;
  setConfig: (config: VaultConfig | null) => void;
}
