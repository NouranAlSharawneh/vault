import type { UpdateCheck } from "@shared/types";

export interface UpdateCheckProps {
  /** This build's version, shown before anything is checked. */
  version: string;
}

export type UpdateCheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "done"; result: UpdateCheck }
  | { phase: "error"; message: string };
