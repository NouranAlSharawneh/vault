import { Markdown } from "@/components/markdown";
import { SplitPane } from "@/components/ui";
import { TRASH_DIR } from "@shared/constants";
import type { ReaderBodyProps } from "./reader-body.types";

function Raw({ body }: { body: string }) {
  return (
    <pre className="m-0 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-2 select-text">
      {body}
    </pre>
  );
}

/**
 * The document itself, in the chosen view, and the path strip under it. The scroller the
 * reader focuses, and ⌘F searches, is the one marked `data-doc-scroller` — in Split, the
 * rendered side.
 */
export function ReaderBody({ doc, view, trashed, onOpenDoc }: ReaderBodyProps) {
  const { meta } = doc;
  const rendered = (
    <Markdown source={doc.body} docPath={meta.path} onOpenDoc={onOpenDoc} linkHeadings />
  );

  return (
    <>
      {view === "split" ? (
        <SplitPane
          className="min-h-0 flex-1"
          storageKey="reader-split"
          left={
            <div
              tabIndex={0}
              aria-label="Markdown source"
              className="min-h-0 flex-1 overflow-y-auto px-12 py-4 -outline-offset-2"
            >
              <div className="mx-auto max-w-170">
                <Raw body={doc.body} />
              </div>
            </div>
          }
          right={
            <div
              data-doc-scroller
              tabIndex={0}
              aria-label="Document"
              className="min-h-0 flex-1 overflow-y-auto px-12 py-4 pb-16 -outline-offset-2"
            >
              <article className="mx-auto max-w-170">{rendered}</article>
            </div>
          }
        />
      ) : (
        <div
          // Its own scroller per document: the next one opens at its top.
          key={meta.path}
          data-doc-scroller
          tabIndex={0}
          aria-label="Document"
          className="min-h-0 flex-1 overflow-y-auto px-12 pt-4 pb-16 -outline-offset-2"
        >
          <article className="mx-auto max-w-170">
            {view === "markdown" ? <Raw body={doc.body} /> : rendered}
          </article>
        </div>
      )}
      <div className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-line px-4 font-mono text-2xs text-ink-4">
        <span className="min-w-0 truncate">
          {trashed ? meta.path.slice(TRASH_DIR.length + 1) : meta.path}
        </span>
        {trashed && <span className="text-ink-3">in trash</span>}
        {meta.unpushed && <span className="text-warn-2">not pushed yet</span>}
      </div>
    </>
  );
}
