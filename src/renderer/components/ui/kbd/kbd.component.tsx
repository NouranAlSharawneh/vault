import type { KbdProps } from "./kbd.types";

export function Kbd({ children, dark = false }: KbdProps) {
  return <kbd className={dark ? "dark" : undefined}>{children}</kbd>;
}
