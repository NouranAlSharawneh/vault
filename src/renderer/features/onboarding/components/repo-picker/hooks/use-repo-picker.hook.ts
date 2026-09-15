import { useEffect, useMemo, useState } from "react";
import type { GitHubRepo } from "@shared/types";
import { DEFAULT_VAULT_NAME } from "@shared/constants";
import { REPO_LIST_LIMIT, REPO_NAME_PATTERN } from "@/constants";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (signedIn)
      api("github:listRepos")
        .then(setRepos)
        .catch((e: unknown) => setError(errorMessage(e)));
  }, [signedIn]);

  useEffect(() => {
    if (existingRoot) return;
    const name =
      choice === "new" ? newName : choice === "local" ? DEFAULT_VAULT_NAME : choice.split("/")[1];
    void api("vault:defaultPath", name || DEFAULT_VAULT_NAME).then(setLocalPath);
  }, [choice, newName, existingRoot]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (repos ?? [])
      .filter((r) => !f || r.fullName.toLowerCase().includes(f))
      .slice(0, REPO_LIST_LIMIT);
  }, [repos, filter]);

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
    setError(null);
    try {
      let repo: GitHubRepo | null = null;
      if (choice === "new") repo = await api("github:createRepo", newName.trim(), true);
      else if (choice !== "local") repo = repos?.find((r) => r.fullName === choice) ?? null;
      setConfig(await api("vault:setup", { repo, localPath }));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return {
    signedIn,
    login: auth.user?.login ?? "",
    repos,
    filtered,
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
    error,
    submit,
    canSubmit: !nameError && !!localPath,
  };
}
