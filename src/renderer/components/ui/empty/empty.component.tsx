import { Logo } from "../logo/logo.component";
import type { EmptyProps } from "./empty.types";

export function Empty({ title, hint, action }: EmptyProps) {
  return (
    <div className="flex h-full animate-fade-in flex-col items-center justify-center px-8 text-center">
      <Logo size={36} tone="mono" className="mb-4 text-line-2" />
      <div className="text-md font-medium text-ink-2">{title}</div>
      {hint && <div className="mt-1 max-w-xs text-sm text-ink-3">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
