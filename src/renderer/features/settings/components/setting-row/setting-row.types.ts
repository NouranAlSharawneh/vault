import type { ReactNode } from "react";

export interface SettingRowProps {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}
