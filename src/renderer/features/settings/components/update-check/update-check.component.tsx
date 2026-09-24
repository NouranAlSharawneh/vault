import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { fire } from "@/lib/api";
import { SettingRow } from "../setting-row/setting-row.component";
import { useUpdateCheck } from "./hooks/use-update-check.hook";
import type { UpdateCheckProps, UpdateCheckState } from "./update-check.types";

function describe(state: UpdateCheckState, version: string) {
  switch (state.phase) {
    case "idle":
      return `You’re on version ${version}.`;
    case "checking":
      return "Checking GitHub…";
    case "error":
      return <span className="text-cherry">{state.message}</span>;
    case "done":
      return state.result.status === "available"
        ? `Version ${state.result.latest} is out. You’re on ${state.result.current}.`
        : state.result.status === "up-to-date"
          ? `You’re up to date (${state.result.current}).`
          : `You’re on version ${state.result.current}. No releases published yet.`;
  }
}

/** "Check for updates": asks GitHub Releases, offers the download page when newer. */
export function UpdateCheck({ version }: UpdateCheckProps) {
  const { state, check, download } = useUpdateCheck();
  const available =
    state.phase === "done" && state.result.status === "available" ? state.result : null;

  return (
    <SettingRow label="Marasca" description={describe(state, version)}>
      {available && (
        <Button
          variant="primary"
          onClick={() => fire(download(available.url), "Couldn’t open the download page")}
        >
          <Download size={12} /> Download {available.latest}
        </Button>
      )}
      <Button variant="outline" loading={state.phase === "checking"} onClick={() => fire(check())}>
        <RefreshCw size={12} /> Check for updates
      </Button>
    </SettingRow>
  );
}
