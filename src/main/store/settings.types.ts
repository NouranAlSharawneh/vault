import type { AuthMethod, VaultConfig } from "@shared/types";

export interface AppSettings {
  vault: VaultConfig | null;
  authMethod: AuthMethod | null;
  githubClientId: string | null;
  onboarded: boolean;
}
