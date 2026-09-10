import { Empty } from "@/components/ui";
import type { DocumentReaderProps } from "./document-reader.types";

/** M1: raw body. Rendered markdown + Mermaid arrive in M3. */
export function DocumentReader({ doc }: DocumentReaderProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="h-12 shrink-0 drag" />
      <div className="flex-1 overflow-y-auto px-12 pb-16">
        {doc ? (
          <article className="mx-auto max-w-170">
            <h1 className="font-serif text-4xl font-medium">{doc.meta.title}</h1>
            <pre className="mt-6 font-serif text-lg whitespace-pre-wrap select-text">
              {doc.body}
            </pre>
          </article>
        ) : (
          <Empty
            title="Select a document"
            hint="Rendered preview, ⌘K search and the editor arrive in the next milestones."
          />
        )}
      </div>
    </main>
  );
}
