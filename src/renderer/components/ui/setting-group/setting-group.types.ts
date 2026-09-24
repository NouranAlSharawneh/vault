import type { ReactNode } from "react";

export interface SettingGroupProps {
  title: string;
  /** `danger` marks the group of actions that can't be undone. */
  tone?: "default" | "danger";
  children: ReactNode;
}
