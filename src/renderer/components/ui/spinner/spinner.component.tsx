import { Loader2 } from "lucide-react";
import { cx } from "@/helpers";
import type { SpinnerProps } from "./spinner.types";

export function Spinner({ size = 14, className }: SpinnerProps) {
  return (
    <Loader2 size={size} aria-hidden className={cx("shrink-0 animate-spin-fast", className)} />
  );
}
