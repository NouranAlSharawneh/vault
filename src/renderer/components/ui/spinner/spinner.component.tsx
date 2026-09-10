import { Loader2 } from "lucide-react";
import { cx } from "@/helpers";
import type { SpinnerProps } from "./spinner.types";

export function Spinner({ className }: SpinnerProps) {
  return <Loader2 size={14} className={cx("animate-spin-fast", className)} />;
}
