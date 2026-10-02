import { cx } from "@/helpers";
import type { KbdProps } from "./kbd.types";

export function Kbd({ children, dark = false, onFill = false }: KbdProps) {
  return <kbd className={cx(dark && "dark", onFill && "on-fill") || undefined}>{children}</kbd>;
}
