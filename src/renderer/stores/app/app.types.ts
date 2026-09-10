import type {
  AuthState,
  IndexSnapshot,
  ScanProgress,
  SyncStatus,
  VaultConfig,
} from "@shared/types";

export interface AppState {
  ready: boolean;
  auth: AuthState;
  config: VaultConfig | null;
  index: IndexSnapshot | null;
  progress: ScanProgress;
  sync: SyncStatus | null;
  platform: string;
  boot: () => Promise<void>;
  refreshIndex: () => Promise<void>;
  setConfig: (config: VaultConfig | null) => void;
}
