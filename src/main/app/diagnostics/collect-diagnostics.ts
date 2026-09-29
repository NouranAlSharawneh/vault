import { homedir, release } from "node:os";
import { app } from "electron";
import { currentGitStatus } from "../../services/git/git-status.service";
import { getSettings } from "../../store/settings.store";
import { session } from "../session/session";
import { diagnosticsText } from "./diagnostics";

/** Settings ▸ Copy diagnostics: everything `diagnosticsText` needs, read now. */
export async function collectDiagnostics(): Promise<string> {
  const vault = session.vault;
  const git = await currentGitStatus().catch(() => null);

  return diagnosticsText({
    app: app.getVersion(),
    electron: process.versions.electron ?? "?",
    chrome: process.versions.chrome ?? "?",
    node: process.versions.node,
    os: `${process.platform} ${release()}`,
    arch: process.arch,
    home: homedir(),
    git,
    vault: getSettings().vault,
    vaultOpen: !!vault,
    vaultError: session.vaultFailure,
    docs: vault ? vault.index.snapshot().docs.length : null,
    sync: vault?.status() ?? null,
    auth: session.auth,
    now: Date.now(),
  });
}
