import { useEffect, useRef } from "react";
import { Markdown } from "@/components/markdown";
import { Button, Dot, Empty, SplitPane } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { SOURCE_OPTIONS } from "@/data/editor.data";
import { MARKDOWN_ID_PREFIX } from "@/data/markdown.data";
import { cx, plural, scrollToAnchor } from "@/helpers";
import { INBOX_COLOR, INBOX_SLUG, TRASH_DIR } from "@shared/constants";
import { projectColor, relativeTime } from "@shared/helpers";
import type { DocMeta } from "@shared/types";
import { ReaderToolbar } from "../reader-toolbar/reader-toolbar.component";
import type { DocumentReaderProps } from "./document-reader.types";

function Raw({ body }: { body: string }) {
  return (
    <pre className="m-0 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-2 select-text">
      {body}
    </pre>
  );
}

/** Where a document came from, as a phrase: "from Claude", "written here". */
function sourcePhrase(source: string): string {
  if (source === "manual") return "written here";
  const label = SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source;

  return `from ${label}`;
}

/** Rendered document with Preview / Markdown / Split views and a metadata strip. */
export function DocumentReader({
  doc: current,
  previous,
  error,
  onRetry,
  listEmpty,
  view,
  onView,
  onStar,
  onTrash,
  onHistory,
  historyOpen,
  trashed,
  onRestore,
  onPurge,
  trashBusy,
  onOpenDoc,
  anchor,
  onAnchorShown,
}: DocumentReaderProps) {
  const root = useRef<HTMLElement>(null);
  const shownPath = current?.meta.path;
  useEffect(() => {
    if (!anchor || anchor.path !== shownPath) return;
    // After the document has painted, so the section exists to be found.
    const frame = requestAnimationFrame(() => {
      const prose = root.current?.querySelector(".prose-doc");
      if (prose) scrollToAnchor(prose, anchor.id, MARKDOWN_ID_PREFIX);
      onAnchorShown?.();
    });

    return () => cancelAnimationFrame(frame);
  }, [anchor, shownPath, onAnchorShown]);
  // While the next document loads, the last one stays up, dimmed and inert, so nothing
  // can be starred or trashed on it by mistake.
  const doc = current ?? previous ?? null;
  const stale = !current && !!previous;
  const meta = doc?.meta ?? null;

  if (error && !current) {
    return (
      <main className="flex h-full min-w-0 flex-col">
        <div className="h-11 shrink-0" />
        <Empty
          title="Couldn’t open this document"
          hint={error}
          action={
            onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            )
          }
        />
      </main>
    );
  }

  return (
    <main
      ref={root}
      className={cx("flex h-full min-w-0 flex-col", stale && "opacity-60 transition-opacity")}
      inert={stale}
      aria-busy={stale}
    >
      <ReaderToolbar
        doc={meta}
        view={view}
        onView={onView}
        onStar={onStar}
        onTrash={onTrash}
        onHistory={onHistory}
        historyOpen={historyOpen}
        trashed={trashed}
        onRestore={onRestore}
        onPurge={onPurge}
        trashBusy={trashBusy}
      />
      {doc && meta ? (
        <>
          {/* One row that wraps rather than compressing: eight tags used to squeeze the
              project name onto two lines and the right-hand metadata into a narrow
              column, without ever overflowing — so nothing looked broken, it just
              stopped being readable. */}
          <MetaRow meta={meta} />
          {view === "split" ? (
            <SplitPane
              className="min-h-0 flex-1"
              storageKey="reader-split"
              left={
                <div className="min-h-0 flex-1 overflow-y-auto px-12 py-4">
                  <div className="mx-auto max-w-170">
                    <Raw body={doc.body} />
                  </div>
                </div>
              }
              right={
                <div className="min-h-0 flex-1 overflow-y-auto px-12 py-4 pb-16">
                  <article className="mx-auto max-w-170">
                    <Markdown source={doc.body} docPath={meta.path} onOpenDoc={onOpenDoc} />
                  </article>
                </div>
              }
            />
          ) : (
            <div
              // Its own scroller per document: the next one opens at its top.
              key={meta.path}
              tabIndex={0}
              aria-label="Document"
              className="min-h-0 flex-1 overflow-y-auto px-12 pt-4 pb-16 outline-none"
            >
              <article className="mx-auto max-w-170">
                {view === "markdown" ? (
                  <Raw body={doc.body} />
                ) : (
                  <Markdown source={doc.body} docPath={meta.path} onOpenDoc={onOpenDoc} />
                )}
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
      ) : (
        <Empty
          title={listEmpty ? "Nothing to read yet" : "Select a document"}
          hint={
            listEmpty
              ? "Documents you capture or write show up here."
              : `Or press ${MOD_KEY} K to search titles, tags and text.`
          }
        />
      )}
    </main>
  );
}

/**
 * Where the document belongs and what it is: project, tags, source, dates, length. Laid
 * in the text's own column, so the tags line up with what they describe.
 */
function MetaRow({ meta }: { meta: DocMeta }) {
  return (
    <div className="px-12 pt-4 pb-6 text-xs text-ink-3">
      {/* In the text's own column, so the tags line up with what they describe. */}
      <div className="mx-auto flex w-full max-w-170 flex-wrap items-center gap-x-2 gap-y-1.5">
        <Dot
          color={meta.projectSlug === INBOX_SLUG ? INBOX_COLOR : projectColor(meta.projectSlug)}
        />
        <span className="whitespace-nowrap">{meta.project || "Inbox"}</span>
        {meta.tags.map((t) => (
          <span key={t} className="chip chip-tag">
            #{t}
          </span>
        ))}
        {/* "saved" beside the created date was a claim about the wrong time. */}
        <span
          className="ml-auto whitespace-nowrap text-ink-4"
          title={`Created ${new Date(meta.created).toLocaleString()} · edited ${new Date(meta.mtime).toLocaleString()}`}
        >
          {sourcePhrase(meta.source)} · created {relativeTime(meta.created)} · edited{" "}
          {relativeTime(meta.mtime)} · {plural(meta.words, "word")}
        </span>
      </div>
    </div>
  );
}
