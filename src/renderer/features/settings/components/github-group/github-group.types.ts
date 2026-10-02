import type { VaultConfig } from "@shared/types";
import type { useSettings } from "../../hooks/use-settings.hook";

export interface GitHubGroupProps {
  s: ReturnType<typeof useSettings>;
  config: VaultConfig;
}
