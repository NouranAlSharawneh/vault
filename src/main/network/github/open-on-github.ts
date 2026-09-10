import { shell } from "electron";
import { GITHUB_WEB } from "@shared/constants";

export function openOnGitHub(path = ""): void {
  void shell.openExternal(`${GITHUB_WEB}/${path.replace(/^\//, "")}`);
}
