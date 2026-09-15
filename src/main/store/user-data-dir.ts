import { existsSync, mkdirSync } from "node:fs";
import { app } from "electron";

/** Electron's per-user app-data folder; created on first access. */
export function userDataDir(): string {
  const dir = app.getPath("userData");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  return dir;
}
