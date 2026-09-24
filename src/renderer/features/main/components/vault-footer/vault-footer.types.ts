import type { VaultConfig } from "@shared/types";

export interface VaultFooterProps {
  config: VaultConfig;
  onSettings: () => void;
}
