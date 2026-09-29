import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { COPIED_FEEDBACK_MS } from "@/constants";
import { errorMessage } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useToast } from "@/stores/toast";
import { SettingRow } from "../setting-row/setting-row.component";

/**
 * Everything someone helping with a problem asks for first, copied in one go: versions,
 * git, the vault and where sync stands, the last error. Paths are shortened and there is
 * no token in it — safe to paste into an issue.
 */
export function DiagnosticsRow() {
  const [copied, setCopied] = useState(false);
  const show = useToast((s) => s.show);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await api("app:copyDiagnostics");
      setCopied(true);
    } catch (e) {
      show(`Couldn’t copy diagnostics: ${errorMessage(e)}`);
    }
  };

  return (
    <SettingRow
      label="Diagnostics"
      description="Versions, sync state and the last error, for a bug report. No token, no documents."
    >
      <Button variant="outline" onClick={() => fire(copy())}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span role="status">{copied ? "Copied" : "Copy diagnostics"}</span>
      </Button>
    </SettingRow>
  );
}
