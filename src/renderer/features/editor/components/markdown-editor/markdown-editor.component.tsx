import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useImperativeHandle } from "react";
import { cx } from "@/helpers";
import { useCodeMirror } from "./hooks/use-codemirror.hook";
import type { MarkdownEditorProps } from "./markdown-editor.types";

export function MarkdownEditor({ dark, className, ref, ...opts }: MarkdownEditorProps) {
  const { host, view } = useCodeMirror(opts);
  useImperativeHandle(
    ref,
    () => ({
      jumpToLine: (line) => {
        const v = view.current;
        if (!v) return;
        const at = v.state.doc.line(Math.min(Math.max(line, 1), v.state.doc.lines)).from;
        v.dispatch({
          selection: EditorSelection.cursor(at),
          effects: EditorView.scrollIntoView(at, { y: "start", yMargin: 24 }),
        });
        v.focus();
      },
      focus: () => view.current?.focus(),
    }),
    [view],
  );

  return <div ref={host} className={cx("h-full min-h-0", dark && "dark", className)} />;
}
