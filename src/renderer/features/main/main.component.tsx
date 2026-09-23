import { useCallback, useEffect, useState } from "react";
import { AuthExpiredBanner } from "@/components/auth-expired-banner/auth-expired-banner.component";
import { NoWriteAccessBanner } from "@/components/no-write-access-banner/no-write-access-banner.component";
import { SplitPane } from "@/components/ui";
import { cx } from "@/helpers";
import { api, fire, on } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import { CommandPalette } from "./components/command-palette/command-palette.component";
import { ConflictSheet } from "./components/conflict-sheet/conflict-sheet.component";
import { DocumentList } from "./components/document-list/document-list.component";
import { DocumentReader } from "./components/document-reader/document-reader.component";
import { HistoryDrawer } from "./components/history-drawer/history-drawer.component";
import { SidebarRail } from "./components/sidebar-rail/sidebar-rail.component";
import { Sidebar } from "./components/sidebar/sidebar.component";
import { TopBar } from "./components/top-bar/top-bar.component";
import { VaultUnavailable } from "./components/vault-unavailable/vault-unavailable.component";
import { useDocumentFilter } from "./hooks/use-document-filter.hook";
import { isTrashed, useDocument } from "./hooks/use-document.hook";
import { useHotkeyWarning } from "./hooks/use-hotkey-warning.hook";
import { useMainShortcuts } from "./hooks/use-main-shortcuts.hook";
import { useSidebarState } from "./hooks/use-sidebar-state.hook";
import { useTrashActions } from "./hooks/use-trash-actions.hook";
import type { ReaderView } from "./main.types";

/**
 * Top bar across the window, then navigation · document list · reader.
 * The list + reader sit in a curved inset panel; the sidebar cycles full → rail → hidden with ⌘\.
 */
export function Main() {
  const index = useApp((s) => s.index);
  // A vault that is set up but would not open has nothing to show here either.
  const config = useApp((s) => (s.vaultError ? null : s.config));
  const trash = useApp((s) => s.trash);
  const show = useToast((s) => s.show);
  const sidebar = useSidebarState();
  const list = useDocumentFilter(index, trash);
  const { showAll, filtered } = list;
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ReaderView>("preview");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const inTrash = list.filter.collection === "trash";
  const doc = useDocument(selected, inTrash ? trash.map((t) => t.meta) : index?.docs);
  const trashActions = useTrashActions(doc?.meta ?? null, setSelected);

  // A capture lands as `doc:reveal`: drop back to All documents so the new doc is in
  // the list, then select it. The index arrives on its own event, so order doesn't matter.
  useEffect(
    () =>
      on("doc:reveal", (path) => {
        // Dropping the filters is what makes the new document findable, but doing it in
        // silence left you looking at a different list than the one you had set up.
        if (filtered) show("Showing all documents, so the new one is in the list");
        showAll();
        setSelected(path);
      }),
    [showAll, filtered, show],
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  // History is about one document, so it is meaningless with nothing selected.
  const toggleHistory = useCallback(() => setHistoryOpen((open) => !open), []);
  const openSettings = useCallback(() => (window.location.hash = "settings"), []);
  useHotkeyWarning(openSettings);
  useMainShortcuts({
    onSearch: openPalette,
    onTrash: () => fire(trashActions.trash()),
    onSettings: openSettings,
    onHistory: toggleHistory,
  });

  // History belongs to a document; with none open, or one in the trash, there is nothing
  // to show — and a stale drawer beside an empty reader would be worse than none.
  const showHistory = historyOpen && !!doc && !inTrash;

  useEffect(() => {
    if (!showHistory) return;
    const onKey = (e: KeyboardEvent) => {
      // The palette and the conflict sheet handle their own Escape and sit above this one.
      if (e.key === "Escape" && !e.defaultPrevented && !paletteOpen && !conflictsOpen)
        setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [showHistory, paletteOpen, conflictsOpen]);

  // Escape closes the review, like every other overlay in the app.
  useEffect(() => {
    if (!conflictsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setConflictsOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [conflictsOpen]);

  const star = useCallback(() => {
    if (doc) fire(api("doc:setStarred", doc.meta.path, !doc.meta.starred));
  }, [doc]);

  if (!config) return <VaultUnavailable />;

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
            sortable={!inTrash && list.filter.collection !== "recent"}
            emptyHint={inTrash ? "Deleted documents wait here until you purge them." : undefined}
          />
        }
        right={
          <DocumentReader
            doc={doc}
            view={view}
            onView={setView}
            onStar={star}
            onTrash={() => fire(trashActions.trash())}
            onHistory={toggleHistory}
            historyOpen={historyOpen}
            trashed={isTrashed(doc?.meta.path ?? null)}
            onRestore={() => fire(trashActions.restore())}
            onPurge={() => fire(trashActions.purge())}
          />
        }
      />
    </div>
  );

  return (
    <div className="relative flex h-full flex-col bg-paper-2">
      <TopBar
        sidebar={sidebar.state}
        onToggleSidebar={sidebar.cycle}
        onSearch={openPalette}
        onReviewConflicts={() => setConflictsOpen(true)}
      />
      <AuthExpiredBanner />
      <NoWriteAccessBanner />
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
        {showHistory && (
          <HistoryDrawer
            // Remounts per document, so its state starts clean without an effect reset.
            key={doc.meta.path}
            path={doc.meta.path}
            onClose={() => setHistoryOpen(false)}
            onRestored={setSelected}
          />
        )}
      </div>
      {conflictsOpen && <ConflictSheet onClose={() => setConflictsOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenDoc={setSelected}
          // Trash acts on the doc in the reader, so the action is offered with its title or not at all.
          {...(doc && !inTrash
            ? { onTrashDoc: () => fire(trashActions.trash()), trashTitle: doc.meta.title }
            : {})}
          onReviewConflicts={() => setConflictsOpen(true)}
        />
      )}
    </div>
  );
}
