import { useCallback, useState } from "react";
import { Button, Empty, SplitPane } from "@/components/ui";
import { cx } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { ReaderView } from "./main.types";
import { useDocument } from "./hooks/use-document.hook";
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
  const sidebar = useSidebarState();
  const list = useDocumentFilter(index);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ReaderView>("preview");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const doc = useDocument(selected);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useMainShortcuts({ onSearch: openPalette });

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
          />
        }
        right={<DocumentReader doc={doc} view={view} onView={setView} onStar={star} />}
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
            onCollection={list.selectCollection}
            onProject={list.selectProject}
            onTag={list.toggleTag}
          />
        )}
        {content}
      </div>
      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} onOpenDoc={setSelected} />
      )}
    </div>
  );
}
