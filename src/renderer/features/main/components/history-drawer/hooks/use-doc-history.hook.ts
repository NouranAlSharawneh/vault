import { useCallback, useEffect, useState } from "react";
import { RESTORED_FROM_FORMAT } from "@/constants";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useToast } from "@/stores/toast";
import { HISTORY_PAGE } from "@shared/constants";
import type { CommitInfo } from "@shared/types";
import type { HistoryState } from "../history-drawer.types";

const EMPTY: HistoryState = {
  commits: [],
  selected: null,
  diff: null,
  diffFor: null,
  loading: true,
  restoring: false,
  error: null,
  diffError: null,
  hasMore: false,
  loadingMore: false,
  compare: false,
};

/** What a diff was asked for: the commit, and whether against the file as it is now. */
const diffKey = (sha: string, compare: boolean) => `${sha}${compare ? ":now" : ""}`;

/** The next page added after the ones already there, without doubling any. */
function append(commits: CommitInfo[], page: CommitInfo[]): CommitInfo[] {
  const seen = new Set(commits.map((c) => c.sha));

  return [...commits, ...page.filter((c) => !seen.has(c.sha))];
}

/**
 * Every commit that touched one document — a page at a time — and what each of them
 * changed, or, asked to compare, everything that changed since. The drawer is mounted with
 * `key={path}`, so switching documents remounts this and the state starts clean — no
 * resetting from inside an effect.
 */
export function useDocHistory(path: string, onRestored: (path: string) => void) {
  const [state, setState] = useState<HistoryState>(EMPTY);
  const [reloads, setReloads] = useState(0);
  const show = useToast((s) => s.show);

  useEffect(() => {
    let cancelled = false;
    api("doc:history", path)
      .then((commits) => {
        if (cancelled) return;
        // Open on the newest change rather than an empty panel.
        setState((s) => ({
          ...s,
          commits,
          loading: false,
          error: null,
          hasMore: commits.length === HISTORY_PAGE,
          selected: commits[0]?.sha ?? null,
        }));
      })
      .catch((e: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: errorMessage(e) }));
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloads]);

  const { selected, commits } = state;
  const newest = commits[0]?.sha ?? null;
  // Against now only means something for a commit older than the newest.
  const compare = state.compare && !!selected && selected !== newest;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const key = diffKey(selected, compare);
    (compare ? api("doc:compare", path, selected) : api("doc:diff", path, selected))
      .then(
        (diff) => !cancelled && setState((s) => ({ ...s, diff, diffFor: key, diffError: null })),
      )
      // One diff that can't be read used to replace the whole drawer, commit list and all,
      // for good.
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState((s) => ({ ...s, diff: null, diffFor: key, diffError: errorMessage(e) })),
      );

    return () => {
      cancelled = true;
    };
  }, [path, selected, compare]);

  const select = useCallback((sha: string) => setState((s) => ({ ...s, selected: sha })), []);
  const setCompare = useCallback((on: boolean) => setState((s) => ({ ...s, compare: on })), []);

  // Fifty commits is where the list used to stop, without a word about the rest.
  const loadMore = useCallback(async () => {
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const page = await api("doc:history", path, commits.length);
      setState((s) => ({
        ...s,
        commits: append(s.commits, page),
        hasMore: page.length === HISTORY_PAGE,
      }));
    } catch (e) {
      show(errorMessage(e));
    } finally {
      setState((s) => ({ ...s, loadingMore: false }));
    }
  }, [path, commits.length, show]);

  const restore = useCallback(async () => {
    if (!selected) return;
    setState((s) => ({ ...s, restoring: true }));
    try {
      const res = await api("doc:restore", path, selected);
      // Restoring writes a new commit rather than rewriting history, so the version you
      // moved away from stays reachable — worth saying, since "restore" sounds final.
      // Named by when it was written: a short sha means nothing to someone reading a toast.
      const from = commits.find((c) => c.sha === selected);
      const when = from
        ? new Date(from.date).toLocaleString(undefined, RESTORED_FROM_FORMAT)
        : selected.slice(0, 7);
      show(`Restored the version from ${when} as a new commit`);
      onRestored(res.path);
      // The restore is itself a commit, so the list it came from is now out of date.
      setReloads((n) => n + 1);
    } catch (e) {
      show(errorMessage(e));
    } finally {
      setState((s) => ({ ...s, restoring: false }));
    }
  }, [path, selected, commits, show, onRestored]);

  return {
    ...state,
    compare,
    newest,
    // Stale until the diff for the current selection (and mode) has arrived.
    diff: selected && state.diffFor === diffKey(selected, compare) ? state.diff : null,
    select,
    setCompare,
    loadMore,
    restore,
  };
}
