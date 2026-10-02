import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Annotation, Compartment, EditorState, Transaction } from "@codemirror/state";
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
  // ⌘F's find and replace bar, in the app's own paper and type rather than the default grey.
  ".cm-panels": {
    backgroundColor: "var(--color-paper-2)",
    color: "var(--color-ink-2)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-panels-top": { borderBottom: "1px solid var(--color-line)" },
  ".cm-search": { fontSize: "var(--text-xs)", padding: "6px 12px" },
  ".cm-search input, .cm-search button": {
    fontFamily: "inherit",
    fontSize: "inherit",
    borderRadius: "var(--radius-xs)",
  },
  ".cm-searchMatch": { backgroundColor: "var(--color-cherry-tint-2)" },
  ".cm-searchMatch-selected": { backgroundColor: "var(--color-warn)" },
});

/**
 * Marks a change that came from `value`, not from the person typing. Loading a document
 * is one: reported back as an edit, it marked every document dirty the moment it opened —
 * the unsaved prompt on every close, the untouched file parked as a draft, and a crash
 * draft overwritten by the file it was meant to rescue.
 */
const FromValue = Annotation.define<boolean>();

type Options = Pick<
  MarkdownEditorProps,
  "value" | "onChange" | "onSubmit" | "placeholder" | "autoFocus" | "readOnly"
>;

/** Mounts a CodeMirror 6 markdown editor into the returned ref and keeps it in sync with `value`. */
export function useCodeMirror({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  readOnly = false,
}: Options) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
  });

  const editable = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return;
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
          "aria-label": "Markdown",
          "aria-multiline": "true",
        }),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(mdHighlight),
        placeholderExt(placeholder ?? ""),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onSubmitRef.current?.();

              return true;
            },
          },
        ]),
        // ⌘F finds, ⌘G / ⇧⌘G step through, ⌥⌘F replaces — a 1 MB document had no way
        // to find anything in it.
        search({ top: true }),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        editable.current.of(EditorState.readOnly.of(readOnly)),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          if (u.transactions.every((t) => t.annotation(FromValue))) return;
          onChangeRef.current(u.state.doc.toString());
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
    if (current === value) return;
    v.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      // Neither an edit to report nor a step to undo: ⌘Z straight after opening used to
      // "undo" the load and leave an empty document.
      annotations: [FromValue.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  // Read-only while a save is on its way: text typed then was dropped when the save
  // came back, marked the document clean and closed the window.
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return host;
}
