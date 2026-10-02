import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { UPDATE_HELPER_WAIT_S } from "@shared/constants";
import { STAGED_APP } from "./stage-update";

/**
 * The swap, run by `/bin/sh` on its own once Marasca has quit: a running app can't replace
 * itself, because Electron starts helper processes from its bundle long after launch.
 *
 * Arguments: the pid to wait for, the app to replace, the staging folder holding the new
 * Marasca.app, the log file, how many seconds to wait, and what opens the app (`open`).
 *
 * It renames the old app into the staging folder and the new one into its place, putting
 * the old one back if the second rename fails, and opens whichever is there at the end.
 * If Marasca never quits it gives up and changes nothing.
 */
export const UPDATE_HELPER_SCRIPT = `#!/bin/sh
pid="$1" target="$2" staging="$3" log="$4" wait="$5" opener="$6"
new="$staging/${STAGED_APP}"
old="$staging/previous.app"
say() { printf '%s %s\\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$log" 2>/dev/null; }

say "waiting for Marasca ($pid) to quit"
ticks=0
while kill -0 "$pid" 2>/dev/null; do
  ticks=$((ticks + 1))
  if [ "$ticks" -gt $((wait * 5)) ]; then
    say "Marasca didn't quit within $wait s; leaving it as it is"
    rm -rf "$staging"
    exit 1
  fi
  sleep 0.2
done

if [ ! -d "$new" ]; then
  say "nothing staged at $new"
elif mv "$target" "$old"; then
  if mv "$new" "$target"; then
    say "installed $target"
  else
    say "couldn't move the new version in; putting the old one back"
    mv "$old" "$target"
  fi
else
  say "couldn't move $target aside"
fi

# Only once an app is in place: the old one may still be in there.
if [ -d "$target" ]; then rm -rf "$staging"; fi
say "opening $target"
"$opener" "$target"
`;

export interface UpdateHelperArgs {
  /** The process to outlive: this Marasca. */
  pid: number;
  /** The app to replace. */
  target: string;
  staging: string;
  log: string;
  /** What opens the app afterwards; tests pass something that records instead. */
  opener?: string;
  waitSeconds?: number;
}

/**
 * Write the swap script into the staging folder and start it, detached so it outlives the
 * quit it is waiting for. The script deletes itself with the staging folder.
 */
export async function spawnUpdateHelper(a: UpdateHelperArgs): Promise<void> {
  const script = join(a.staging, "swap.sh");
  await writeFile(script, UPDATE_HELPER_SCRIPT, { mode: 0o755 });
  await mkdir(dirname(a.log), { recursive: true });
  const args = [
    script,
    String(a.pid),
    a.target,
    a.staging,
    a.log,
    String(a.waitSeconds ?? UPDATE_HELPER_WAIT_S),
    a.opener ?? "/usr/bin/open",
  ];
  const child = spawn("/bin/sh", args, { detached: true, stdio: "ignore" });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
}
