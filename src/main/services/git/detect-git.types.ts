export interface DetectGitOptions {
  /** A git chosen in Settings. When set it is the only one tried. */
  customPath?: string | null;
  platform?: NodeJS.Platform;
  home?: string;
  /** The user's login shell, asked where git is as a last resort. */
  shell?: string;
}
