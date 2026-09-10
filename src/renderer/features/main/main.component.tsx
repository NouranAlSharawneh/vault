import { useCallback, useState } from "react";
import { Button, Empty, SplitPane, Toast } from "@/components/ui";
import { cx } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { ReaderView } from "./main.types";
import { isTrashed, useDocument } from "./hooks/use-document.hook";
import { useTrashActions } from "./hooks/use-trash-actions.hook";
import { useDocumentFilter } from "./hooks/use-document-filter.hook";
import { useSidebarState } from "./hooks/use-sidebar-state.hook";
import { useMainShortcuts } from "./hooks/use-main-shortcuts.hook";
import { TopBar } from "./components/top-bar/top-bar.component";
import { Sidebar } from "./components/sidebar/sidebar.component";
import { SidebarRail } from "./components/sidebar-rail/sidebar-rail.component";
import { DocumentList } from "./components/document-list/document-list.component";
import { DocumentReader } from "./components/document-reader/document-reader.component";
import { CommandPalette } from "./components/command-palette/command-palette.component";

/**
 * Top bar across the window, then navigation · document list · reader.
 * The list + reader sit in a curved inset panel; the sidebar cycles full → rail → hidden with ⌘\.
 */
export function Main() {
  const index = useApp((s) => s.index);
  const config = useApp((s) => s.config);
  const trash = useApp((s) => s.trash);
  const toast = useToast((s) => s.toast);
  const dismissToast = useToast((s) => s.dismiss);
  const sidebar = useSidebarState();
  const list = useDocumentFilter(index, trash);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ReaderView>("preview");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const inTrash = list.filter.collection === "trash";
  const doc = useDocument(selected, inTrash ? trash.map((t) => t.meta) : index?.docs);
  const trashActions = useTrashActions(doc?.meta ?? null, setSelected);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openSettings = useCallback(() => (window.location.hash = "settings"), []);
  useMainShortcuts({
    onSearch: openPalette,
    onTrash: trashActions.trash,
    onSettings: openSettings,
  });

  const star = useCallback(() => {
    if (doc) void api("doc:setStarred", doc.meta.path, !doc.meta.starred);
  }, [doc]);

  if (!config) {
    return (
      <Empty
        title="No vault connected"
        action={
          <Button variant="primary" onClick={() => (window.location.hash = "onboarding")}>
            Set up Vault
          </Button>
        }
      />
    );
  }

  const content = (
    <div
      className={cx(
        "mr-2 mb-2 min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-line bg-paper shadow-pop",
        // Sidebar and rail carry their own right padding as the gutter; hidden needs one here.
        sidebar.state === "hidden" && "ml-2",
      )}
    >
      <SplitPane
        className="h-full"
        storageKey="list-reader-split"
        defaultRatio={0.32}
        minRatio={0.2}
        maxRatio={0.5}
        left={
          <DocumentList
            title={list.title}
            docs={list.docs}
            selected={selected}
            onSelect={setSelected}
            sort={list.filter.sort}
            onSort={list.setSort}
            activeTags={list.filter.tags}
            onRemoveTag={list.toggleTag}
            onClearTags={list.clearTags}
            sortable={!inTrash}
            emptyHint={inTrash ? "Deleted documents wait here until you purge them." : undefined}
          />
        }
        right={
          <DocumentReader
            doc={doc}
            view={view}
            onView={setView}
            onStar={star}
            onTrash={trashActions.trash}
            trashed={isTrashed(doc?.meta.path ?? null)}
            onRestore={trashActions.restore}
            onPurge={trashActions.purge}
          />
        }
      />
    </div>
  );

  return (
    <div className="relative flex h-full flex-col bg-paper-2">
      <TopBar sidebar={sidebar.state} onToggleSidebar={sidebar.cycle} onSearch={openPalette} />
      <div className="flex min-h-0 flex-1">
        {sidebar.state === "rail" && (
          <SidebarRail
            index={index}
            filter={list.filter}
            onCollection={list.selectCollection}
            onProject={list.selectProject}
            onExpand={() => sidebar.setState("full")}
          />
        )}
        {sidebar.state === "full" && (
          <Sidebar
            index={index}
            config={config}
            filter={list.filter}
            trashCount={trash.length}
            onCollection={list.selectCollection}
            onProject={list.selectProject}
            onTag={list.toggleTag}
          />
        )}
        {content}
      </div>
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenDoc={setSelected}
          onTrashDoc={doc && !inTrash ? trashActions.trash : undefined}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
