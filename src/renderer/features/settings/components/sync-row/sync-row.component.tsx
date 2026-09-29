import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { SettingRow } from "../setting-row/setting-row.component";
import { syncSummary } from "./sync-summary";

/** A clock that moves once a minute, so "2 min ago" doesn't stay "just now". */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);

    return () => clearInterval(t);
  }, []);

  return now;
}

/**
 * When this Mac last reached GitHub each way, and a push on demand. The badge says
 * whether things are fine; this says since when, which is the question after a trip
 * offline.
 */
export function SyncRow() {
  const sync = useApp((s) => s.sync);
  const now = useMinute();

  return (
    <SettingRow label="Sync" description={<span role="status">{syncSummary(sync, now)}</span>}>
      <Button
        variant="outline"
        loading={sync?.state === "pushing"}
        disabled={!sync || (sync.ahead === 0 && sync.state === "synced")}
        onClick={() => fire(api("sync:pushNow"), "Couldn’t push")}
      >
        Push now
      </Button>
    </SettingRow>
  );
}
