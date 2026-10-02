import { isValidElement } from "react";

/** The fence's language, as written after the backticks (`ts`, `bash`), if it names one. */
export function fenceLanguage(child: unknown): string | null {
  if (!isValidElement<{ className?: string }>(child)) return null;

  return /(?:^|\s)language-([\w+#.-]+)/.exec(child.props.className ?? "")?.[1] ?? null;
}
