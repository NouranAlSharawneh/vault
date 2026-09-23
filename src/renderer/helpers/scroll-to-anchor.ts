/** The closest ancestor that scrolls, or null when none does. */
function scrollParent(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }

  return null;
}

/**
 * Scroll `root`'s nearest scroll container so the element with this `#fragment` sits at the
 * top. The sanitizer prefixes every id (`user-content-intro`) while leaving links as written
 * (`#intro`), so the prefixed id is tried first and the bare one second. Only the scroll
 * container moves — `scrollIntoView` would also nudge the window's fixed layout.
 * Returns false when there is no such element.
 */
export function scrollToAnchor(root: Element, id: string, prefix: string): boolean {
  const withIds = [...root.querySelectorAll("[id]")];
  const target = withIds.find((el) => el.id === prefix + id) ?? withIds.find((el) => el.id === id);
  if (!target) return false;
  const container = scrollParent(target);
  if (!container) return false;
  container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top;

  return true;
}
