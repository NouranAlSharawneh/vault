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
  progress: ScanProgress;
  sync: SyncStatus | null;
  /** Contents of `.trash/`; refreshed with the index and after trash actions. */
  trash: TrashedDoc[];
  platform: string;
  boot: () => Promise<void>;
  refreshIndex: () => Promise<void>;
  refreshTrash: () => Promise<void>;
  setConfig: (config: VaultConfig | null) => void;
}
