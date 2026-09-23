import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt, drawSelection } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import type { MarkdownEditorProps } from "../markdown-editor.types";

const mdHighlight = HighlightStyle.define([
  { tag: tags.heading, class: "cm-md-heading" },
  { tag: tags.monospace, class: "cm-md-code" },
  { tag: tags.emphasis, class: "cm-md-emphasis" },
  { tag: tags.strong, class: "cm-md-strong" },
  { tag: tags.url, class: "cm-md-url" },
  { tag: tags.link, class: "cm-md-link" },
]);

/**
 * Rules CodeMirror's base theme would otherwise win: it scopes its own under a generated
 * class, so the same selectors in global.css lose on specificity. The scroller sets
 * `font-family: monospace` (the content inherits it, not the brand mono), and
 * drawSelection() hides the native caret and draws `.cm-cursor`, black by default.
 */
const vaultTheme = EditorView.theme({
  ".cm-content": { fontFamily: "var(--font-mono)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-cherry)" },
});

type Options = Pick<
  MarkdownEditorProps,
  "value" | "onChange" | "onSubmit" | "placeholder" | "autoFocus"
>;

/** Mounts a CodeMirror 6 markdown editor into the returned ref and keeps it in sync with `value`. */
export function useCodeMirror({ value, onChange, onSubmit, placeholder, autoFocus }: Options) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
  });

  useEffect(() => {
    if (!host.current) return;
    const submitKeys = new Compartment();
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        vaultTheme,
        // CodeMirror turns spellcheck off on its content; this is prose, so turn it back
        // on (Electron's checker is on for every window). The OS's autocorrect and
        // auto-capitalisation would rewrite markdown syntax, so those stay off.
        EditorView.contentAttributes.of({
          spellcheck: "true",
          autocorrect: "off",
          autocapitalize: "off",
        }),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(mdHighlight),
        placeholderExt(placeholder ?? ""),
        submitKeys.of(
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                onSubmitRef.current?.();

                return true;
              },
            },
          ]),
        ),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    if (autoFocus) v.focus();

    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor owns its document after mount; external `value` changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return host;
}
