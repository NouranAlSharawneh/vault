import type { ButtonHTMLAttributes, Ref } from "react";

export interface ListRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  selected?: boolean;
  /**
   * nav — compact sidebar row · option — radio-like row · menu — dropdown entry
   * palette — dark ⌘K result · rail — square icon slot
   */
  kind?: "nav" | "option" | "menu" | "palette" | "rail";
  dark?: boolean;
}
