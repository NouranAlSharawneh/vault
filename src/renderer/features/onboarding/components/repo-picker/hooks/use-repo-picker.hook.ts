import { useCallback, useEffect, useMemo, useState } from "react";
import { REPO_LIST_LIMIT, REPO_NAME_PATTERN } from "@/constants";
import { errorMessage } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { DEFAULT_VAULT_NAME } from "@shared/constants";
import type { GitHubRepo } from "@shared/types";
import type { RepoChoice } from "../repo-picker.types";

/** Repo list, selection, new-repo name, local path and the setup call. */
export function useRepoPicker(onDone: () => void) {
  const auth = useApp((s) => s.auth);
  const config = useApp((s) => s.config);
  const setConfig = useApp((s) => s.setConfig);
  const signedIn = auth.status === "signed-in";
  // Attaching a repo to a vault that already exists: the folder is settled, and
  // suggesting a fresh one would quietly set up a second, empty vault instead.
  const existingRoot = config?.root ?? null;

  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState<RepoChoice>(signedIn ? "new" : "local");
  const [newName, setNewName] = useState(DEFAULT_VAULT_NAME);
  const [localPath, setLocalPath] = useState(existingRoot ?? "");
  const [busy, setBusy] = useState(false);
  // Kept apart: a failed list load belongs in the list box, a failed Continue under the
  // button — and a new attempt at one must not wipe the other.
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listAttempt, setListAttempt] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api("github:listRepos")
      .then((r) => !cancelled && setRepos(r))
      .catch((e: unknown) => !cancelled && setListError(errorMessage(e)));

    return () => {
      cancelled = true;
    };
  }, [signedIn, listAttempt]);

  const retryList = useCallback(() => {
    setListError(null);
    setRepos(null);
    setListAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (existingRoot) return;
    const name =
      choice === "new" ? newName : choice === "local" ? DEFAULT_VAULT_NAME : choice.split("/")[1];
    fire(api("vault:defaultPath", name || DEFAULT_VAULT_NAME).then(setLocalPath));
  }, [choice, newName, existingRoot]);

  const matching = useMemo(() => {
    const f = filter.trim().toLowerCase();

    return (repos ?? []).filter((r) => !f || r.fullName.toLowerCase().includes(f));
  }, [repos, filter]);
  const filtered = matching.slice(0, REPO_LIST_LIMIT);

  const nameError =
    choice === "new" && !REPO_NAME_PATTERN.test(newName)
      ? "Letters, numbers, dashes, dots and underscores only."
      : null;

  const chooseFolder = async () => {
    const p = await api("vault:chooseFolder");
    if (p) setLocalPath(p);
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      let repo: GitHubRepo | null = null;
      if (choice === "new") repo = await api("github:createRepo", newName.trim(), true);
      else if (choice !== "local") repo = repos?.find((r) => r.fullName === choice) ?? null;
      setConfig(await api("vault:setup", { repo, localPath }));
      onDone();
    } catch (e) {
      setSubmitError(errorMessage(e));
      setBusy(false);
    }
  };

  return {
    signedIn,
    login: auth.user?.login ?? "",
    repos,
    filtered,
    matchCount: matching.length,
    filter,
    setFilter,
    choice,
    setChoice,
    newName,
    setNewName,
    nameError,
    localPath,
    chooseFolder,
    busy,
    listError,
    retryList,
    submitError,
    submit,
    canSubmit: !nameError && !!localPath,
  };
}
