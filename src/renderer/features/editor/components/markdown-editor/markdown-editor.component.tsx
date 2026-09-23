import { cx } from "@/helpers";
import { useCodeMirror } from "./hooks/use-codemirror.hook";
import type { MarkdownEditorProps } from "./markdown-editor.types";

export function MarkdownEditor({ dark, className, ...opts }: MarkdownEditorProps) {
  const host = useCodeMirror(opts);

  return <div ref={host} className={cx("h-full min-h-0", dark && "dark", className)} />;
}
