/** What a failed `runFile` rejects with: the exit code (or spawn error code) and stderr. */
export interface RunFileError extends Error {
  code?: number | string;
  stderr: string;
}
