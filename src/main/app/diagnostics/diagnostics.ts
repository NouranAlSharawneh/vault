import type { AuthState, GitStatus, SyncStatus, VaultConfig } from "@shared/types";

export interface DiagnosticsInput {
  app: string;
  electron: string;
  chrome: string;
  node: string;
  os: string;
  arch: string;
  home: string;
  git: GitStatus | null;
  vault: VaultConfig | null;
  vaultOpen: boolean;
  /** Why the configured vault isn't open, if it isn't. */
  vaultError: string | null;
  docs: number | null;
  sync: SyncStatus | null;
  auth: AuthState;
  now: number;
}

const when = (at: number | null | undefined, now: number) =>
  at ? `${new Date(at).toISOString()} (${Math.round((now - at) / 60_000)} min ago)` : "never";

/**
 * What someone helping with a problem asks for first, as plain text to paste into an
 * issue. Paths are shortened to ~ and nothing secret is in it: no token, only whether
 * there is one and how it was given.
 */
export function diagnosticsText(d: DiagnosticsInput): string {
  const tidy = (s: string) => (d.home ? s.split(d.home).join("~") : s);
  const git = !d.git
    ? "not checked yet"
    : d.git.state === "ready" || d.git.state === "too-old"
      ? `${d.git.state} ${d.git.version} (${d.git.source}, ${tidy(d.git.binary)})`
      : d.git.state;
  const lines = [
    `Marasca ${d.app}`,
    `Electron ${d.electron} · Chrome ${d.chrome} · Node ${d.node}`,
    `${d.os} (${d.arch})`,
    `git: ${git}`,
    `GitHub: ${d.auth.status}${d.auth.method ? ` via ${d.auth.method}` : ""}${
      d.auth.user ? ` as ${d.auth.user.login}` : ""
    }`,
  ];
  if (!d.vault) return [...lines, "Vault: not set up"].join("\n");
  lines.push(
    `Vault: ${tidy(d.vault.root)} · ${d.vaultOpen ? `open, ${d.docs ?? 0} documents` : "not open"}`,
    `Repository: ${d.vault.remote ?? "local only"} · branch ${d.vault.branch}`,
  );
  if (d.vaultError) lines.push(`Why it isn't open: ${tidy(d.vaultError)}`);
  if (d.sync) {
    lines.push(
      `Sync: ${d.sync.state} · ${d.sync.ahead} ahead, ${d.sync.behind} behind · ${d.sync.conflicts} to review`,
      `Last push: ${when(d.sync.lastPushAt, d.now)} · last pull: ${when(d.sync.lastPullAt, d.now)}`,
    );
    if (d.sync.failure) lines.push(`Last failure: ${d.sync.failure} (${d.sync.failedOp ?? "?"})`);
    if (d.sync.lastError) lines.push(`Last error: ${tidy(d.sync.lastError)}`);
  }

  return lines.join("\n");
}
