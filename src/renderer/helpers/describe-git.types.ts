/** Something the user can do about git from inside Marasca. */
export type GitAction =
  "install" | "reinstall" | "reopenInstaller" | "recheck" | "choose" | "useDetected" | "copy";

/** How loud the notice is: a quiet line, a wait, or something to fix. */
export type GitTone = "ok" | "wait" | "warn" | "alert";

export interface GitCopy {
  tone: GitTone;
  title: string;
  body: string | null;
  /** A command to run in Terminal, shown with a Copy button. */
  command: string | null;
  primary: GitAction | null;
  secondary: GitAction[];
}
