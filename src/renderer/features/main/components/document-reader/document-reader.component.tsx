import { useEffect, useRef } from "react";
import { Button, Dot, Empty } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { SOURCE_OPTIONS } from "@/data/editor.data";
import { MARKDOWN_ID_PREFIX } from "@/data/markdown.data";
import { cx, plural, scrollToAnchor } from "@/helpers";
import { INBOX_COLOR, INBOX_SLUG } from "@shared/constants";
import { projectColor, relativeTime } from "@shared/helpers";
import type { DocMeta } from "@shared/types";
import { ReaderToolbar } from "../reader-toolbar/reader-toolbar.component";
import { DocumentOutline } from "./components/document-outline/document-outline.component";
import { FindBar } from "./components/find-bar/find-bar.component";
import { ReaderBody } from "./components/reader-body/reader-body.component";
import type { DocumentReaderProps } from "./document-reader.types";
import { useFindInDoc } from "./hooks/use-find-in-doc.hook";
import { useOutline } from "./hooks/use-outline.hook";

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
  focusDoc,
  onDocFocused,
}: DocumentReaderProps) {
  const root = useRef<HTMLElement>(null);
  const shownPath = current?.meta.path;
  const find = useFindInDoc(root, `${shownPath}:${view}`);
  const outline = useOutline(root, shownPath);
  useEffect(() => {
    if (!focusDoc || focusDoc !== shownPath) return;
    // The document's own scroller (the preview side of a split), after it has painted.
    const frame = requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLElement>("[data-doc-scroller]")
        ?.focus({ preventScroll: true });
      onDocFocused?.();
    });

    return () => cancelAnimationFrame(frame);
  }, [focusDoc, shownPath, onDocFocused]);
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
          tone="error"
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
      className={cx(
        "relative flex h-full min-w-0 flex-col",
        stale && "opacity-60 transition-opacity",
      )}
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
        // The outline is of rendered headings: the raw view has none to read.
        onOutline={doc && view !== "markdown" ? outline.toggle : undefined}
        outlineOpen={outline.open}
      />
      {outline.open && (
        <DocumentOutline
          headings={outline.headings}
          onPick={outline.pick}
          onClose={outline.close}
        />
      )}
      {find.open && doc && (
        <FindBar
          query={find.query}
          onQuery={find.setQuery}
          count={find.count}
          current={find.current}
          onNext={find.next}
          onPrevious={find.previous}
          onClose={find.close}
        />
      )}
      {doc && meta ? (
        <>
          {/* One row that wraps rather than compressing: eight tags used to squeeze the
              project name onto two lines and the right-hand metadata into a narrow
              column, without ever overflowing — so nothing looked broken, it just
              stopped being readable. */}
          <MetaRow meta={meta} />
          <ReaderBody doc={doc} view={view} trashed={trashed} onOpenDoc={onOpenDoc} />
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
