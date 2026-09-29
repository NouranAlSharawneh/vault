import { useCallback, useEffect, useRef, useState } from "react";
import { AuthExpiredBanner } from "@/components/auth-expired-banner/auth-expired-banner.component";
import { NoWriteAccessBanner } from "@/components/no-write-access-banner/no-write-access-banner.component";
import { SplitPane } from "@/components/ui";
import { cx, describeSave } from "@/helpers";
import { api, fire, on } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useLibrary } from "@/stores/library";
import { useToast } from "@/stores/toast";
import type { DocReveal } from "@shared/types";
import { CommandPalette } from "./components/command-palette/command-palette.component";
import { ConflictSheet } from "./components/conflict-sheet/conflict-sheet.component";
import { DocumentList } from "./components/document-list/document-list.component";
import { DocumentReader } from "./components/document-reader/document-reader.component";
import { HistoryDrawer } from "./components/history-drawer/history-drawer.component";
import { SidebarRail } from "./components/sidebar-rail/sidebar-rail.component";
import { Sidebar } from "./components/sidebar/sidebar.component";
import { TopBar } from "./components/top-bar/top-bar.component";
import { VaultUnavailable } from "./components/vault-unavailable/vault-unavailable.component";
import { reconcileSelection, useDocumentFilter } from "./hooks/use-document-filter.hook";
import { isTrashed, useDocument } from "./hooks/use-document.hook";
import { useHotkeyWarning } from "./hooks/use-hotkey-warning.hook";
import { useMainShortcuts } from "./hooks/use-main-shortcuts.hook";
import { useSidebarState } from "./hooks/use-sidebar-state.hook";
import { useTrashActions } from "./hooks/use-trash-actions.hook";

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
  const selected = useLibrary((s) => s.selected);
  const setSelected = useLibrary((s) => s.setSelected);
  const view = useLibrary((s) => s.view);
  const setView = useLibrary((s) => s.setView);
  const list = useDocumentFilter(index, trash, (docs) =>
    setSelected((s) => reconcileSelection(s, docs)),
  );
  const { showAll, filtered, docs: listed } = list;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const inTrash = list.filter.collection === "trash";
  const loaded = useDocument(selected, inTrash ? trash.map((t) => t.meta) : index?.docs);
  const doc = loaded.doc;

  // The reader shows what the list holds. A tag narrowing the list, a pull or an outside
  // delete removing the file, a rename moving it — each left the reader on a document the
  // list no longer had, and ⌘⌫ trashed something you couldn't see.
  useEffect(() => {
    setSelected((s) => reconcileSelection(s, listed));
  }, [listed, setSelected]);

  /** The document after `path` in the list, or before it at the end: where a removal lands. */
  const neighbour = useCallback(
    (path: string) => {
      const i = listed.findIndex((d) => d.path === path);

      return i < 0 ? null : ((listed[i + 1] ?? listed[i - 1] ?? null)?.path ?? null);
    },
    [listed],
  );
  const trashActions = useTrashActions(doc?.meta ?? null, setSelected, neighbour);

  /**
   * Select a document, dropping back to All documents only when the current list doesn't
   * hold it. Every way to a document from outside the list — a capture, an editor's save,
   * the palette, a link in another document — comes through here, so none of them can
   * leave the reader on something the list isn't showing.
   */
  const reveal = useCallback(
    (path: string): boolean => {
      const inList = listed.some((d) => d.path === path);
      if (!inList) showAll();
      setSelected(path);

      return inList;
    },
    [listed, showAll, setSelected],
  );

  const lastReveal = useRef(0);
  const onReveal = useCallback(
    ({ id, path, saved }: DocReveal) => {
      if (id <= lastReveal.current) return;
      lastReveal.current = id;
      const inList = reveal(path);
      // The editor closes as it saves, so this is the only place left to say how it went.
      if (saved) {
        const cleared = filtered && !inList ? " · showing all documents" : "";
        show(
          describeSave(saved) + cleared,
          saved.keptOtherVersion
            ? { label: "History", run: () => setHistoryOpen(true) }
            : undefined,
        );
      } else if (filtered && !inList) {
        // Dropping the filters is what makes the new document findable, but doing it in
        // silence left you looking at a different list than the one you had set up.
        show("Showing all documents so the new one is in the list");
      }
    },
    [reveal, filtered, show],
  );
  // Pushed while the library is up; asked for when it mounts, since one sent while the
  // window was still booting found nobody listening.
  useEffect(() => on("doc:reveal", onReveal), [onReveal]);
  useEffect(() => {
    let live = true;
    api("window:takeReveal")
      .then((r) => live && r && onReveal(r))
      .catch(() => undefined);

    return () => {
      live = false;
    };
    // Once per mount: later reveals arrive as events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A relative `.md` link in the reader. Checked against the index so a broken link says so
  // instead of blanking the reader. Its `#section` is kept for once the document is up —
  // it used to be dropped, and the link opened at the top.
  // Opened from ⌘K or a link: focus goes to the document once it is up, so Space and
  // Page Down read on. It used to go back to whatever had it before the palette.
  const [focusDoc, setFocusDoc] = useState<string | null>(null);
  const docFocused = useCallback(() => setFocusDoc(null), []);
  const [anchor, setAnchor] = useState<{ path: string; id: string } | null>(null);
  const clearAnchor = useCallback(() => setAnchor(null), []);
  const openLinkedDoc = useCallback(
    (path: string, hash?: string) => {
      if (!useApp.getState().index?.docs.some((d) => d.path === path)) {
        show("That link points to a document that isn’t in the vault");

        return;
      }
      setAnchor(hash ? { path, id: hash } : null);
      setFocusDoc(path);
      reveal(path);
    },
    [reveal, show],
  );
  const openFromPalette = useCallback(
    (path: string) => {
      setFocusDoc(path);

      return reveal(path);
    },
    [reveal],
  );

  // Back from Settings (or at launch), focus is on nothing: it goes to the list, so the
  // arrows work at once and a screen reader says where you are.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      document.querySelector<HTMLElement>("[data-doc-list]")?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  // History is about one document: meaningless with none selected, or one in the trash —
  // and toggling it then left it open for the next document, unasked.
  // It needs the path, not the loaded text: ⌘Y pressed while the next document was
  // still loading — straight after an arrow key — used to be dropped without a word.
  const canShowHistory = !!selected && !inTrash;
  // Set when History is opened on purpose, so the drawer takes focus that once — not
  // each time it remounts for the next document.
  const [historyFocus, setHistoryFocus] = useState(false);
  const takenHistoryFocus = useCallback(() => setHistoryFocus(false), []);
  const toggleHistory = useCallback(() => {
    if (!canShowHistory) return;
    setHistoryFocus(!historyOpen);
    setHistoryOpen((open) => !open);
  }, [canShowHistory, historyOpen]);
  const openSettings = useCallback(() => (window.location.hash = "settings"), []);
  const trashNow = useCallback(() => fire(trashActions.trash()), [trashActions]);
  useHotkeyWarning(openSettings);
  useMainShortcuts({
    onSearch: openPalette,
    onTrash: trashNow,
    onSettings: openSettings,
    onHistory: toggleHistory,
  });

  const showHistory = historyOpen && canShowHistory;

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

  const star = useCallback(() => {
    if (doc) fire(api("doc:setStarred", doc.meta.path, !doc.meta.starred));
  }, [doc]);

  if (!config)
    return (
      <div className="flex h-full flex-col bg-paper">
        {/* No top bar here, and the window has no title bar of its own: without this strip
            there was nothing to drag it by. */}
        <div className="h-12 shrink-0 drag" />
        <VaultUnavailable />
      </div>
    );

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
        minPx={240}
        maxPx={560}
        label="Resize the document list"
        left={
          <DocumentList
            title={list.title}
            collection={list.filter.collection}
            project={list.filter.project}
            scrollKey={JSON.stringify(list.filter)}
            docs={list.docs}
            selected={selected}
            onSelect={setSelected}
            onOpen={(path) => fire(api("window:openEditor", path), "Couldn’t open the editor")}
            sort={list.filter.sort}
            onSort={list.setSort}
            activeTags={list.activeTags}
            onRemoveTag={list.toggleTag}
            onClearTags={list.clearTags}
            sortable={!inTrash && list.filter.collection !== "recent"}
            dateOf={list.dateOf}
            hotkey={config.hotkey}
          />
        }
        right={
          <DocumentReader
            doc={doc}
            previous={loaded.previous}
            error={loaded.error}
            onRetry={loaded.retry}
            view={view}
            onView={setView}
            onStar={star}
            onTrash={trashNow}
            onHistory={toggleHistory}
            historyOpen={historyOpen}
            trashed={isTrashed(doc?.meta.path ?? null)}
            onRestore={() => fire(trashActions.restore())}
            onPurge={() => fire(trashActions.purge())}
            trashBusy={trashActions.busy}
            onOpenDoc={openLinkedDoc}
            anchor={anchor}
            onAnchorShown={clearAnchor}
            focusDoc={focusDoc}
            onDocFocused={docFocused}
            listEmpty={listed.length === 0}
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
            trashCount={trash.length}
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
            onSettings={openSettings}
          />
        )}
        {content}
        {showHistory && (
          <HistoryDrawer
            // Remounts per document, so its state starts clean without an effect reset.
            key={selected}
            path={selected}
            onClose={() => setHistoryOpen(false)}
            takeFocus={historyFocus}
            onFocusTaken={takenHistoryFocus}
            onRestored={setSelected}
          />
        )}
      </div>
      {/* The sheet closes itself on Escape, through its own dialog shell. */}
      {conflictsOpen && <ConflictSheet onClose={() => setConflictsOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenDoc={openFromPalette}
          // Trash acts on the doc in the reader, so the action is offered with its title or not at all.
          {...(doc && !inTrash ? { onTrashDoc: trashNow, trashTitle: doc.meta.title } : {})}
          onReviewConflicts={() => setConflictsOpen(true)}
        />
      )}
    </div>
  );
}
