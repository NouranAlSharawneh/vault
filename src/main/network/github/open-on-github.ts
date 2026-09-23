import { shell } from "electron";
import { GITHUB_WEB } from "@shared/constants";
import { fire } from "../../lib/fire";

export function openOnGitHub(path = ""): void {
  fire(shell.openExternal(`${GITHUB_WEB}/${path.replace(/^\//, "")}`), "opening GitHub");
}
