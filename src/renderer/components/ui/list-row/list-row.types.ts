import type { ButtonHTMLAttributes, Ref } from "react";

export interface ListRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  selected?: boolean;
  /**
   * nav — compact sidebar row · item — bordered list entry · option — radio-like row
   * menu — dropdown entry · palette — dark ⌘K result · rail — square icon slot
   */
  kind?: "nav" | "item" | "option" | "menu" | "palette" | "rail";
  dark?: boolean;
}
