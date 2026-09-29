import { AlertTriangle } from "lucide-react";
import { cx } from "@/helpers";
import { Logo } from "../logo/logo.component";
import type { EmptyProps } from "./empty.types";

/**
 * Nothing to show, or something that failed to show — one layout for both, so an error
 * screen and an empty list read as the same family. There were four title styles.
 */
export function Empty({
  title,
  hint,
  action,
  tone = "neutral",
  icon,
  children,
  className,
}: EmptyProps) {
  const error = tone === "error";

  return (
    <div
      role={error ? "alert" : undefined}
      className={cx(
        "flex h-full animate-fade-in flex-col items-center justify-center px-8 text-center",
        className,
      )}
    >
      <div className="mb-4">
        {icon ??
          (error ? (
            <AlertTriangle size={28} strokeWidth={1.5} className="text-cherry" aria-hidden />
          ) : (
            <Logo size={36} tone="mono" className="text-line-2" />
          ))}
      </div>
      <div className="max-w-md text-md font-medium text-balance text-ink-2">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-sm text-ink-3">{hint}</div>}
      {children}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
