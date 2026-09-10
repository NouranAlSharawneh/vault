// Wipes Vault's app data (settings, token, index cache) so the next launch starts at
// onboarding. Never touches the vault repo itself. Usage: npm run reset
import { rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const { name, productName } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const base =
  process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));

// Electron uses package.json `name` in dev and `productName` in packaged builds.
for (const dir of new Set([join(base, name), join(base, productName)])) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`removed ${dir}`);
  } else console.log(`not found ${dir}`);
}
console.log("Next launch starts at onboarding.");
