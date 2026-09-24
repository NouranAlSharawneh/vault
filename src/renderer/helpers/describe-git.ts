import { GIT_SOURCE_LABELS } from "@/data/git.data";
import { GIT_MIN_VERSION, XCODE_LICENSE_COMMAND } from "@shared/constants";
import type { GitStatus } from "@shared/types";
import type { GitCopy } from "./describe-git.types";

const NONE: Omit<GitCopy, "tone" | "title"> = {
  body: null,
  command: null,
  primary: null,
  secondary: [],
};

/** What to tell the user about git in each state, and what to offer them. */
export function describeGit(status: GitStatus): GitCopy {
  switch (status.state) {
    case "ready":
      return {
        ...NONE,
        tone: "ok",
        title: `git ${status.version} is ready`,
        body: GIT_SOURCE_LABELS[status.source],
      };
    case "missing":
      return {
        ...NONE,
        tone: "alert",
        title: "Marasca saves through git, and this Mac doesn't have it yet",
        body: "Apple includes git in its free Command Line Tools. Apple's installer runs once and takes a few minutes.",
        primary: "install",
        secondary: ["choose"],
      };
    case "installing":
      return {
        ...NONE,
        tone: "wait",
        title: "Installing Apple's Command Line Tools",
        body: "Marasca will notice when the install finishes. Carry on in the meantime.",
        secondary: ["reopenInstaller", "recheck"],
      };
    case "broken":
      return {
        ...NONE,
        tone: "alert",
        title: "A macOS update removed git's tools",
        body: "This often happens after a major macOS update. Reinstalling takes a few minutes and doesn't touch your files.",
        primary: "reinstall",
        secondary: ["choose"],
      };
    case "license":
      return {
        ...NONE,
        tone: "warn",
        title: "git is installed, but Xcode's licence hasn't been accepted",
        body: "Run this once in Terminal. It asks for your Mac password.",
        command: XCODE_LICENSE_COMMAND,
        secondary: ["recheck"],
      };
    case "too-old":
      return {
        ...NONE,
        tone: "warn",
        title: `git ${status.version} is too old`,
        body: `Marasca needs git ${GIT_MIN_VERSION.replace(/\.0$/, "")} or newer. Update Apple's tools from Software Update, or install a newer git with Homebrew.`,
        secondary: ["recheck", "choose"],
      };
    case "custom-invalid":
      return {
        ...NONE,
        tone: "alert",
        title: "The git chosen in Settings doesn't work",
        body: `${status.reason} (${status.binary})`,
        primary: "useDetected",
        secondary: ["choose"],
      };
  }
}
