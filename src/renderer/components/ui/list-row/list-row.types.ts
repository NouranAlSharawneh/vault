import type { ButtonHTMLAttributes } from "react";

export interface ListRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** `nav` — compact sidebar row · `item` — bordered list entry · `option` — radio-like row */
  kind?: "nav" | "item" | "option";
}
