import { Pencil, Plus } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { SyncBadge } from "@/components/sync-badge/sync-badge.component";
import { Button, Empty } from "@/components/ui";
import { api } from "@/lib/api";
import type { DocumentReaderProps } from "./document-reader.types";

/** Rendered document. Split/markdown views, history and the wider toolbar arrive in M3. */
export function DocumentReader({ doc }: DocumentReaderProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-end gap-2 pr-4 drag">
        <div className="flex items-center gap-2 no-drag">
          <SyncBadge />
          {doc && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => api("window:openEditor", doc.meta.path)}
            >
              <Pencil size={11} /> Edit
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => api("window:openEditor")}>
            <Plus size={11} /> New
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-12 pb-16">
        {doc ? (
          <article className="mx-auto max-w-170">
            <Markdown source={doc.body} />
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
