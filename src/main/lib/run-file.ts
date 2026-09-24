import { execFile } from "node:child_process";
import type { RunFileError } from "./run-file.types";

/**
 * Run a program directly (no shell) and resolve with its stdout. A failure keeps the exit
 * code and stderr on the error, which is where tools like git say what actually went wrong.
 */
export function runFile(file: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr: String(stderr ?? "") }) as RunFileError);
      else resolve(String(stdout));
    });
  });
}
