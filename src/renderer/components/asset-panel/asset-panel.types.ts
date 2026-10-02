import type { AssetImport, AssetRef } from "@shared/types";

export interface AssetPlanOptions {
  body: string;
  project: string;
  /** Folder of the file the text came from, when known (a `.md` copied in Finder). */
  sourceDir?: string | null;
  /**
   * The saved document's own folder. Images found there are already where they belong:
   * not listed, and not copied — a pasted image, once saved, used to come back as
   * "1 image referenced … copy" under a path in the vault.
   */
  homeDir?: string | null;
}

export interface AssetPlan {
  /** Every relative image/media path in the body, in order. */
  refs: AssetRef[];
  baseDir: string | null;
  /** True when Marasca worked the folder out itself rather than being handed one. */
  detected: boolean;
  /** Still being looked for. */
  pending: boolean;
  /** How many refs are being looked for right now. */
  lookingFor: number;
  /** Found refs that won't be copied: skipped, large and not asked for, or over the limit. */
  excluded: string[];
  found: number;
  missing: number;
  /** Refs that will not be in the commit, so their links break in the saved doc. */
  stranded: number;
  /** Bytes that would be committed. */
  bytes: number;
  chooseFolder: () => Promise<void>;
  toggle: (ref: string) => void;
  /** Resolves once the images have been looked for (or after a short wait). */
  whenSettled: () => Promise<void>;
  /** What to attach to the save request; undefined when there is nothing to copy. */
  request: AssetImport | undefined;
}

export interface AssetPanelProps {
  plan: AssetPlan;
  dark?: boolean;
  /**
   * Where the images are, said in place of their folder, which can't then be changed: an
   * image from the clipboard waits in a temporary folder nobody needs to see or pick.
   */
  baseLabel?: string;
  className?: string;
}
