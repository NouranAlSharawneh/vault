import { useCallback, useState } from "react";

const KEY = "editor-focus-mode";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** ⌥⌘P: the preview folded away so the text has the window. Remembered across windows. */
export function useFocusMode() {
  const [on, setOn] = useState(read);
  const toggle = useCallback(() => {
    setOn((was) => {
      try {
        localStorage.setItem(KEY, was ? "0" : "1");
      } catch {
        /* not remembered, still toggled */
      }

      return !was;
    });
  }, []);

  return { focusMode: on, toggleFocusMode: toggle };
}
