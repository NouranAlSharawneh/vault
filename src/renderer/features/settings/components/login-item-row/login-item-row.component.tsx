import { useEffect, useState } from "react";
import { Switch } from "@/components/ui";
import { errorMessage } from "@/helpers";
import { api, fire } from "@/lib/api";
import type { LoginItemState } from "@shared/types";
import { SettingRow } from "../setting-row/setting-row.component";

/**
 * Open at login. The capture shortcut only exists while Marasca runs, so a Mac that
 * restarted had none until the app was opened by hand. Started this way it opens no
 * window: the menu bar item is how you know it is there.
 */
export function LoginItemRow() {
  const [state, setState] = useState<LoginItemState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api("app:loginItem")
      .then((s) => live && setState(s))
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, []);

  const toggle = async (open: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setState(await api("app:setLoginItem", open));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingRow
      label="Open at login"
      description={
        error ? (
          <span className="text-cherry">{error}</span>
        ) : state && !state.available ? (
          "Only the installed Marasca can open at login — this is a development build."
        ) : (
          "Starts in the menu bar when you log in, so the capture shortcut works from the start."
        )
      }
    >
      <Switch
        label="Open at login"
        checked={!!state?.openAtLogin}
        disabled={!state?.available}
        busy={busy}
        onChange={(open) => fire(toggle(open))}
      />
    </SettingRow>
  );
}
