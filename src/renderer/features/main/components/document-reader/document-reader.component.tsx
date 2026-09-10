import { INBOX_COLOR, INBOX_SLUG, TRASH_DIR } from "@shared/constants";
import { projectColor, relativeTime } from "@shared/helpers";
import { Markdown } from "@/components/markdown";
import { Dot, Empty, SplitPane } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { plural } from "@/helpers";
import { ReaderToolbar } from "../reader-toolbar/reader-toolbar.component";
import type { DocumentReaderProps } from "./document-reader.types";

function Raw({ body }: { body: string }) {
  return (
    <pre className="m-0 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-2 select-text">
      {body}
    </pre>
  );
}

/** Rendered document with Preview / Markdown / Split views and a metadata strip. */
export function DocumentReader({
  doc,
  view,
  onView,
  onStar,
  onTrash,
  trashed,
  onRestore,
  onPurge,
}: DocumentReaderProps) {
  const meta = doc?.meta ?? null;
  return (
    <main className="flex h-full min-w-0 flex-col">
      <ReaderToolbar
        doc={meta}
        view={view}
        onView={onView}
        onStar={onStar}
        onTrash={onTrash}
        trashed={trashed}
        onRestore={onRestore}
        onPurge={onPurge}
      />
      {doc && meta ? (
        <>
          <div className="flex items-center gap-2 px-12 pt-4 pb-6 text-xs text-ink-3">
            <Dot
              color={meta.projectSlug === INBOX_SLUG ? INBOX_COLOR : projectColor(meta.projectSlug)}
            />
            <span>{meta.project || "Inbox"}</span>
            {meta.tags.map((t) => (
              <span key={t} className="chip chip-tag">
                #{t}
              </span>
            ))}
            <span className="ml-auto text-ink-4">
              from {meta.source} · saved {relativeTime(meta.created)} · {plural(meta.words, "word")}
            </span>
          </div>
          {view === "split" ? (
            <SplitPane
              className="min-h-0 flex-1"
              storageKey="reader-split"
              left={
                <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
                  <Raw body={doc.body} />
                </div>
              }
              right={
                <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4 pb-16">
                  <Markdown source={doc.body} docPath={meta.path} />
                </div>
              }
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-12 pt-4 pb-16">
              <article className="mx-auto max-w-170">
                {view === "markdown" ? (
                  <Raw body={doc.body} />
                ) : (
                  <Markdown source={doc.body} docPath={meta.path} />
                )}
              </article>
            </div>
          )}
          <div className="flex h-7 shrink-0 items-center justify-between border-t border-line px-4 font-mono text-2xs text-ink-4">
            <span>{trashed ? meta.path.slice(TRASH_DIR.length + 1) : meta.path}</span>
            {trashed && <span className="text-ink-3">in trash</span>}
            {meta.unpushed && <span className="text-warn">not pushed yet</span>}
          </div>
        </>
      ) : (
        <Empty
          title="Select a document"
          hint={`Or press ${MOD_KEY} K to search titles, tags and text.`}
        />
      )}
    </main>
  );
}
