import { cx } from "@/helpers";
import type { KbdProps } from "./kbd.types";

export function Kbd({ children, dark = false, onFill = false, className }: KbdProps) {
  return (
    <kbd className={cx(dark && "dark", onFill && "on-fill", className) || undefined}>
      {children}
    </kbd>
  );
}
