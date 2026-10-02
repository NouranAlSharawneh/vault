import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REPO_LIST_LIMIT, REPO_NAME_PATTERN } from "@/constants";
import { errorMessage } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { CREATE_REPO_FORBIDDEN, DEFAULT_VAULT_NAME, MARASCA_REPO_MARK } from "@shared/constants";
import type { GitHubRepo } from "@shared/types";
import type { RepoChoice } from "../repo-picker.types";

/** Repo list, selection, new-repo name, local path and the setup call. */
export function useRepoPicker(onDone: () => void, preferLocal = false) {
  const auth = useApp((s) => s.auth);
  const config = useApp((s) => s.config);
  const setConfig = useApp((s) => s.setConfig);
  // Creating or cloning the vault is the first thing that runs git. Until it works the
  // button waits — and so does the GitHub repo, which used to be created and then left
  // behind, empty, when setup failed on a Mac without git. An unknown status doesn't
  // block: main checks again in setup either way, and says why if it refuses.
  const gitReady = useApp((s) => !s.gitStatus || s.gitStatus.state === "ready");
  const signedIn = auth.status === "signed-in";
  // The token form has people make a fine-grained token scoped to one repo, which can't
  // create another — so for them the list is the way in, not "Create a new private repo".
  const tokenUser = auth.method === "pat";
  // Attaching a repo to a vault that already exists: the folder is settled, and
  // suggesting a fresh one would quietly set up a second, empty vault instead.
  const existingRoot = config?.root ?? null;

  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState<RepoChoice | null>(() =>
    initialChoice(config?.remote ?? null, signedIn, preferLocal, tokenUser),
  );
  // Chosen by the person (or already settled): nothing picks for them after that.
  const touched = useRef(!!config?.remote || preferLocal);
  const choose = useCallback((c: RepoChoice) => {
    touched.current = true;
    setChoice(c);
  }, []);
  const [newName, setNewName] = useState(DEFAULT_VAULT_NAME);
  const [localPath, setLocalPath] = useState(existingRoot ?? "");
  const [busy, setBusy] = useState(false);
  // A repo this screen already made, so a retry after a failed setup uses it instead of
  // failing on "name already exists".
  const [created, setCreated] = useState<GitHubRepo | null>(null);
  // Kept apart: a failed list load belongs in the list box, a failed Continue under the
  // button — and a new attempt at one must not wipe the other.
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listAttempt, setListAttempt] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api("github:listRepos")
      .then((r) => {
        if (cancelled) return;
        const sorted = vaultsFirst(r);
        setRepos(sorted);
        // A token scoped to one repo lists exactly that repo: nothing else to pick.
        const [only] = r;
        if (only && r.length === 1) setChoice((c) => c ?? only.fullName);
        // A vault Marasca made before — a second Mac, a run after Reset — is the answer
        // unless the person has already chosen. Offering to create another sent people
        // to "name already exists", or worse, to a second, empty vault.
        const vault = sorted.find(isMarascaVault);
        if (vault && !touched.current)
          setChoice((c) => (c === "new" || c === null ? vault.fullName : c));
      })
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

  // A folder picked by hand stays picked. Changing the selection used to put the default
  // path back without a word.
  const pickedFolder = useRef(false);
  useEffect(() => {
    if (existingRoot || pickedFolder.current) return;
    fire(api("vault:defaultPath", folderName(choice, newName)).then(setLocalPath));
  }, [choice, newName, existingRoot]);

  // iCloud Drive syncing the same folder git does leaves duplicates and missing files;
  // the default, ~/Documents, is exactly such a folder on many Macs.
  const [folderWarning, setFolderWarning] = useState<string | null>(null);
  useEffect(() => {
    if (!localPath) return;
    let live = true;
    api("vault:folderWarning", localPath)
      .then((w) => live && setFolderWarning(w))
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [localPath]);

  const matching = useMemo(() => {
    const f = filter.trim().toLowerCase();

    return (repos ?? []).filter((r) => !f || r.fullName.toLowerCase().includes(f));
  }, [repos, filter]);
  const filtered = matching.slice(0, REPO_LIST_LIMIT);

  const login = auth.user?.login ?? "";
  const existing = choice === "new" ? findOwn(repos, login, newName) : null;
  const nameError = nameProblem(choice, newName, existing);
  const selectedRepo = repos?.find((r) => r.fullName === choice) ?? null;

  const chooseFolder = async () => {
    const p = await api("vault:chooseFolder");
    if (p) {
      pickedFolder.current = true;
      setLocalPath(p);
    }
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      let repo: GitHubRepo | null = null;
      if (choice === "new") {
        const name = newName.trim();
        repo = created?.name === name ? created : await api("github:createRepo", name, true);
        setCreated(repo);
      } else if (choice !== "local") repo = repos?.find((r) => r.fullName === choice) ?? null;
      setConfig(await api("vault:setup", { repo, localPath }));
      onDone();
    } catch (e) {
      const message = errorMessage(e);
      // The token can't create repos: point at the list, fresh, so the one they make
      // on GitHub shows up in it.
      if (message === CREATE_REPO_FORBIDDEN) {
        setChoice(null);
        retryList();
      }
      setSubmitError(message);
      setBusy(false);
    }
  };

  return {
    signedIn,
    tokenUser,
    login,
    existing,
    selectedRepo,
    // Nothing is cloned for a local vault, or when attaching a repo to one that exists.
    folderLabel: choice === "local" || existingRoot ? "vault folder" : "clones to",
    repos,
    filtered,
    matchCount: matching.length,
    filter,
    setFilter,
    choice,
    setChoice: choose,
    continueLabel: continueLabel(choice, login, newName, !!existingRoot),
    folderWarning: existingRoot ? null : folderWarning,
    isMarascaVault,
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
    canSubmit: choice !== null && !nameError && !!localPath && gitReady,
  };
}

/**
 * Back on this screen with a repo already connected: that one is the answer. Otherwise
 * local when asked for (or signed out), the list for a one-repo token, else a new repo.
 */
function initialChoice(
  remote: string | null,
  signedIn: boolean,
  preferLocal: boolean,
  tokenUser: boolean,
): RepoChoice | null {
  if (remote) return remote;
  if (!signedIn || preferLocal) return "local";

  return tokenUser ? null : "new";
}

/** A repo Marasca created: it says so in its description. */
function isMarascaVault(repo: GitHubRepo): boolean {
  return MARASCA_REPO_MARK.test(repo.description ?? "");
}

/** Vaults Marasca made come first; otherwise GitHub's order (most recently pushed). */
function vaultsFirst(repos: GitHubRepo[]): GitHubRepo[] {
  return [...repos.filter(isMarascaVault), ...repos.filter((r) => !isMarascaVault(r))];
}

/**
 * What Continue will do, said on the button: "Create nunu/vault", "Use nunu/notes",
 * "Create local vault". A bare "Continue" left people unsure whether pressing it made a
 * repo on GitHub.
 */
export function continueLabel(
  choice: RepoChoice | null,
  login: string,
  newName: string,
  attaching: boolean,
): string {
  if (choice === "local") return attaching ? "Keep it local" : "Create local vault";
  if (choice === "new")
    return `Create ${login ? `${login}/` : ""}${newName.trim() || DEFAULT_VAULT_NAME}`;
  if (choice) return attaching ? `Connect ${choice}` : `Use ${choice}`;

  return "Continue";
}

/** The folder name to suggest for a choice. */
function folderName(choice: RepoChoice | null, newName: string): string {
  if (choice === "new") return newName || DEFAULT_VAULT_NAME;
  if (choice === "local" || choice === null) return DEFAULT_VAULT_NAME;

  return choice.split("/")[1] || DEFAULT_VAULT_NAME;
}

/**
 * A second Mac, or a run after Reset: the vault repo is already there. Creating it again
 * only ever failed on GitHub's side, with "Repository creation failed."
 */
function findOwn(repos: GitHubRepo[] | null, login: string, name: string): GitHubRepo | null {
  const wanted = `${login}/${name}`.toLowerCase();

  return repos?.find((r) => r.fullName.toLowerCase() === wanted) ?? null;
}

function nameProblem(
  choice: RepoChoice | null,
  name: string,
  existing: GitHubRepo | null,
): string | null {
  if (choice !== "new") return null;
  if (!REPO_NAME_PATTERN.test(name)) return "Letters, numbers, dashes, dots and underscores only.";

  return existing ? `You already have ${existing.fullName}.` : null;
}
