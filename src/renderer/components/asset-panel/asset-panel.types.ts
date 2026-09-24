import type { AssetImport, AssetRef } from "@shared/types";

export interface AssetPlanOptions {
  body: string;
  project: string;
  /** Folder of the file the text came from, when known (a `.md` copied in Finder). */
  sourceDir?: string | null;
}

export interface AssetPlan {
  /** Every relative image/media path in the body, in order. */
  refs: AssetRef[];
  baseDir: string | null;
  /** True when Marasca worked the folder out itself rather than being handed one. */
  detected: boolean;
  /** Refs the user unticked (too big, not wanted). */
  excluded: string[];
  found: number;
  missing: number;
  /** Refs that will not be in the commit, so their links break in the saved doc. */
  stranded: number;
  /** Bytes that would be committed. */
  bytes: number;
  chooseFolder: () => Promise<void>;
  toggle: (ref: string) => void;
  /** What to attach to the save request; undefined when there is nothing to copy. */
  request: AssetImport | undefined;
}

export interface AssetPanelProps {
  plan: AssetPlan;
  dark?: boolean;
  className?: string;
}
