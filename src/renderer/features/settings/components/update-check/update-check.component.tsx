import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { fire } from "@/lib/api";
import type { UpdateInstall } from "@shared/types";
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

const MB = 1024 * 1024;

/** What an install under way says in place of the check's answer; null when none is. */
function describeInstall(install: UpdateInstall) {
  switch (install.phase) {
    case "downloading": {
      const got = (install.received / MB).toFixed(0);
      if (!install.total) return `Downloading ${install.version}… ${got} MB`;
      const pct = Math.floor((install.received / install.total) * 100);

      return `Downloading ${install.version}… ${pct}% of ${(install.total / MB).toFixed(0)} MB`;
    }
    case "installing":
      return `Installing ${install.version}…`;
    case "restarting":
      return `Restarting into ${install.version}…`;
    case "failed":
      return <span className="text-cherry">{install.message}</span>;
    default:
      return null;
  }
}

const BUSY_LABEL = {
  downloading: "Downloading…",
  installing: "Installing…",
  restarting: "Restarting…",
};

/**
 * "Check for updates", and when a newer version is out, one click to install it: download,
 * check, quit, reopen. Where this copy can't replace itself, the download page instead.
 */
export function UpdateCheck({ version }: UpdateCheckProps) {
  const { state, install, check, download, update } = useUpdateCheck();
  const available =
    state.phase === "done" && state.result.status === "available" ? state.result : null;
  const busy =
    install.phase === "downloading" ||
    install.phase === "installing" ||
    install.phase === "restarting"
      ? install.phase
      : null;
  const description =
    describeInstall(install) ??
    (available && install.phase === "manual" ? (
      <>
        {describe(state, version)} {install.reason}
      </>
    ) : (
      describe(state, version)
    ));

  return (
    <SettingRow label="Version" description={description}>
      {busy && (
        <Button variant="primary" loading>
          {BUSY_LABEL[busy]}
        </Button>
      )}
      {!busy && available && install.phase === "manual" && (
        <Button
          variant="primary"
          onClick={() => fire(download(available.url), "Couldn’t open the download page")}
        >
          <Download size={12} /> Download {available.latest}
        </Button>
      )}
      {!busy && available && install.phase === "failed" && (
        <Button
          variant="outline"
          onClick={() => fire(download(available.url), "Couldn’t open the download page")}
        >
          Download page
        </Button>
      )}
      {!busy && available && install.phase !== "manual" && (
        <Button variant="primary" onClick={() => fire(update(available.latest))}>
          <Download size={12} />{" "}
          {install.phase === "failed" ? "Try again" : `Update to ${available.latest}`}
        </Button>
      )}
      <Button
        variant="outline"
        loading={state.phase === "checking"}
        disabled={!!busy}
        onClick={() => fire(check())}
      >
        <RefreshCw size={12} /> Check for updates
      </Button>
    </SettingRow>
  );
}
