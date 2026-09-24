import { useCallback, useEffect, useState } from "react";
import { RESTORED_FROM_FORMAT } from "@/constants";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useToast } from "@/stores/toast";
import type { HistoryState } from "../history-drawer.types";

const EMPTY: HistoryState = {
  commits: [],
  selected: null,
  diff: null,
  diffFor: null,
  loading: true,
  restoring: false,
  error: null,
};

/**
 * Every commit that touched one document, and what each of them changed.
 * The drawer is mounted with `key={path}`, so switching documents remounts this and the
 * state starts clean — no resetting from inside an effect.
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
        setState((s) => ({ ...s, commits, loading: false, selected: commits[0]?.sha ?? null }));
      })
      .catch((e: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: errorMessage(e) }));
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloads]);

  const { selected } = state;
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api("doc:diff", path, selected)
      .then((diff) => !cancelled && setState((s) => ({ ...s, diff, diffFor: selected })))
      .catch((e: unknown) => !cancelled && setState((s) => ({ ...s, error: errorMessage(e) })));

    return () => {
      cancelled = true;
    };
  }, [path, selected]);

  const select = useCallback((sha: string) => setState((s) => ({ ...s, selected: sha })), []);

  const restore = useCallback(async () => {
    if (!selected) return;
    setState((s) => ({ ...s, restoring: true }));
    try {
      const res = await api("doc:restore", path, selected);
      // Restoring writes a new commit rather than rewriting history, so the version you
      // moved away from stays reachable — worth saying, since "restore" sounds final.
      // Named by when it was written: a short sha means nothing to someone reading a toast.
      const from = state.commits.find((c) => c.sha === selected);
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
  }, [path, selected, state.commits, show, onRestored]);

  return {
    ...state,
    // Stale until the diff for the current selection has arrived.
    diff: state.diffFor === selected ? state.diff : null,
    select,
    restore,
  };
}
