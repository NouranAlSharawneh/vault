import { EditorView } from "@codemirror/view";

/** Takes one image and answers what to link it by, or null when it couldn't be kept. */
export type ImageHandler = (file: File) => Promise<string | null>;

const IMAGE = /^image\/(png|jpe?g|gif|webp)$/;

/** The image files among what was pasted or dropped. Text is left to CodeMirror. */
export function imageFiles(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => IMAGE.test(f.type));
}

/** `![alt](ref)` for each image, alt from its file name (a screenshot's "image" stays so). */
export function imageMarkdown(files: File[], refs: (string | null)[]): string {
  return files
    .map((f, i) => {
      const ref = refs[i];
      if (!ref) return null;
      const alt = f.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "") || "image";

      return `![${alt}](${ref})`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Paste or drop an image into the text: each file is handed to `onImage` to be kept
 * until the save, and its link goes in where the cursor (or the drop) was. Only images
 * are taken; a paste of text is CodeMirror's as ever.
 */
export function imagePasteDrop(onImage: () => ImageHandler | undefined) {
  const insert = async (view: EditorView, files: File[], from: number, to: number) => {
    const handle = onImage();
    if (!handle) return;
    const refs = await Promise.all(files.map((f) => handle(f).catch(() => null)));
    const text = imageMarkdown(files, refs);
    if (!text) return;
    // The document may have moved on while the files were being kept.
    const end = view.state.doc.length;
    const a = Math.min(from, end);
    const b = Math.min(Math.max(to, a), end);
    view.dispatch({
      changes: { from: a, to: b, insert: text },
      selection: { anchor: a + text.length },
      scrollIntoView: true,
      userEvent: "input.paste",
    });
  };

  return EditorView.domEventHandlers({
    paste(e, view) {
      const files = imageFiles(e.clipboardData?.files);
      if (!files.length) return false;
      e.preventDefault();
      const { from, to } = view.state.selection.main;
      insert(view, files, from, to).catch(() => undefined);

      return true;
    },
    drop(e, view) {
      const files = imageFiles(e.dataTransfer?.files);
      if (!files.length) return false;
      e.preventDefault();
      const at = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
      insert(view, files, at, at).catch(() => undefined);

      return true;
    },
  });
}
