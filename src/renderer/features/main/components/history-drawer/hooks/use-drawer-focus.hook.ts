import { type KeyboardEvent, useEffect, useRef } from "react";

/**
 * Focus for the history drawer. Opened on purpose (⌘Y, the toolbar), it takes focus onto
 * the selected commit, and gives it back to whatever opened it when it closes. Remounted
 * for the next document while open, it leaves focus where it is: arrowing down the list
 * with History open must not keep jumping into the drawer.
 *
 * ↑/↓, Home and End move through the commits; the list is one Tab stop.
 */
export function useDrawerFocus(
  commits: { sha: string }[],
  selected: string | null,
  select: (sha: string) => void,
  takeFocus: boolean,
  onFocusTaken?: () => void,
) {
  const list = useRef<HTMLUListElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // What had focus when it opened, for the way back.
  useEffect(() => {
    if (!takeFocus) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const drawer = list.current?.closest("aside");

    return () => {
      const active = document.activeElement;
      // Only if focus was in the drawer (and so went with it): not from the list.
      if (!active || active === document.body || drawer?.contains(active))
        returnTo.current?.focus?.();
    };
    // Captured once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Onto the selected commit once there is one.
  const taken = useRef(false);
  useEffect(() => {
    if (!takeFocus || taken.current || !selected) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-sha="${selected}"]`);
    if (!row) return;
    taken.current = true;
    row.focus();
    onFocusTaken?.();
  }, [takeFocus, selected, commits, onFocusTaken]);

  const onKeyDown = (e: KeyboardEvent) => {
    const at = commits.findIndex((c) => c.sha === selected);
    const next =
      e.key === "ArrowDown"
        ? at + 1
        : e.key === "ArrowUp"
          ? at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? commits.length - 1
              : null;
    if (next === null || next < 0 || next >= commits.length) return;
    e.preventDefault();
    const sha = commits[next].sha;
    select(sha);
    list.current?.querySelector<HTMLElement>(`[data-sha="${sha}"]`)?.focus();
  };

  return { list, onKeyDown };
}
