/** Strip Electron's IPC wrapper so the UI shows only the real message. */
export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);

  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}
