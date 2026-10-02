import { type RefObject, useEffect } from "react";

/**
 * Each setup step takes focus on its heading as it appears, unless one of its own fields
 * already took it (the token form focuses its input). The steps remount on every change,
 * so focus went down with the button that was pressed and landed on <body>: a screen
 * reader said nothing, and Tab started from the top of the window.
 */
export function useStepFocus(step: string, host: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const root = host.current;
      if (!root || root.contains(document.activeElement)) return;
      const heading = root.querySelector<HTMLElement>("h1, h2");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [step, host]);

  // The window says what it is showing, and stops saying it when setup is left.
  useEffect(() => {
    const before = document.title;
    document.title = "Set up Marasca";

    return () => {
      document.title = before;
    };
  }, []);
}
