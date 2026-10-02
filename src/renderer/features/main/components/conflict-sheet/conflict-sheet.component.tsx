import { Laptop } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, DialogHeader, DialogShell, Empty, GitHubMark, Spinner } from "@/components/ui";
import { cx, describeResolution, errorMessage, plural } from "@/helpers";
import { api } from "@/lib/api";
import { useToast } from "@/stores/toast";
import { relativeTime } from "@shared/helpers";
import type { ConflictChoice } from "@shared/types";
import type {
  ConflictRowProps,
  ConflictSheetProps,
  VersionCardProps,
} from "./conflict-sheet.types";
import { useConflicts } from "./hooks/use-conflicts.hook";
import { useVersions } from "./hooks/use-versions.hook";

/**
 * Two versions of the same document, side by side, with a way to say which one wins.
 *
 * Nothing here is an interruption: by the time this opens, both versions are already
 * saved and committed. It is a review, not a gate — which is why it can be closed with
 * anything unanswered, and why the least destructive option is the one set apart.
 */
export function ConflictSheet({ onClose }: ConflictSheetProps) {
  const { pairs, error, reload } = useConflicts();
  // One answer at a time, across every row: the other card stayed clickable while one was
  // being settled, and two answers in flight could send both versions to the trash.
  const [settling, setSettling] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  // Settled the last one: the toast has said which way it went, and a sheet saying
  // "nothing to review" is one more thing to close.
  useEffect(() => {
    if (answered && pairs?.length === 0) onClose();
  }, [answered, pairs, onClose]);

  return (
    <DialogShell
      label="review conflicting versions"
      onClose={onClose}
      backdropClassName="pt-16"
      className="flex max-h-full w-235 max-w-full animate-pop-in flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sheet"
    >
      <div data-testid="conflict-sheet" className="flex min-h-0 flex-col">
        <DialogHeader
          className="border-b border-line"
          title={
            pairs?.length ? `${plural(pairs.length, "document")} changed in two places` : "Versions"
          }
          closeLabel="close conflicts"
          onClose={onClose}
        />

        {/* Loading, empty and failed all stand in the same room. Without a floor the
            sheet collapsed to a wide strip the moment the last pair was settled. */}
        {error ? (
          <div className="flex min-h-56 items-center justify-center p-4 text-xs text-cherry">
            {error}
          </div>
        ) : !pairs ? (
          <div className="flex min-h-56 items-center justify-center gap-2 p-4 text-xs text-ink-4">
            <Spinner /> Reading both versions…
          </div>
        ) : !pairs.length ? (
          <div className="flex min-h-56 items-center justify-center">
            <Empty title="Nothing to review" hint="Both versions have been settled." />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {pairs.map((pair) => (
              <ConflictRow
                key={pair.theirs.path}
                pair={pair}
                onResolved={() => {
                  setAnswered(true);
                  reload();
                }}
                settling={settling}
                onSettling={setSettling}
              />
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

/** One document, its two versions, and the three things you can do about them. */
function ConflictRow({ pair, onResolved, settling, onSettling }: ConflictRowProps) {
  const [busy, setBusy] = useState<ConflictChoice | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { versions, failed: unreadable } = useVersions(pair);
  const locked = !!settling;
  const panes = useRef<(HTMLDivElement | null)[]>([null, null]);

  /**
   * Scroll one version and the other follows. Two long versions of the same document
   * line up almost everywhere, so comparing them by scrolling each in turn is work the
   * pair can do for you. The flag is there because setting scrollTop fires `scroll`
   * again, and two panes nudging each other never settles.
   */
  const syncing = useRef(false);
  const onPaneScroll = (from: number) => () => {
    if (syncing.current) return;
    const [a, b] = panes.current;
    const source = from === 0 ? a : b;
    const target = from === 0 ? b : a;
    if (!source || !target) return;
    syncing.current = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => (syncing.current = false));
  };

  const resolve = (choice: ConflictChoice) => {
    if (locked) return;
    setBusy(choice);
    setFailed(null);
    onSettling(pair.theirs.path);
    void api("conflicts:resolve", pair.theirs.path, choice)
      .finally(() => onSettling(null))
      .then(() => {
        // The row just vanishes otherwise, and which way it went is the thing to confirm.
        useToast
          .getState()
          .show(describeResolution(choice, pair.mine.title, fileName(pair.theirs.path)));
        onResolved();
      })
      .catch((e: unknown) => {
        setFailed(errorMessage(e));
        setBusy(null);
      });
  };

  return (
    <section className="border-b border-line/70 px-4 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="truncate text-base font-medium">{pair.mine.title}</h2>
        <span className="shrink-0 font-mono text-2xs leading-none text-ink-4">
          {pair.mine.path}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <VersionCard
          where="This Mac"
          icon={<Laptop size={12} />}
          when={relativeTime(pair.mine.mtime)}
          words={pair.mine.words}
          lines={versions?.mine ?? null}
          changed={versions?.onlyMine ?? EMPTY}
          fallback={pair.mine.excerpt}
          unreadable={unreadable}
          paneRef={(el) => (panes.current[0] = el)}
          onScroll={onPaneScroll(0)}
          action="Use this one"
          actionLabel="Use this Mac’s version"
          onKeep={() => resolve("mine")}
          busy={busy === "mine"}
          faded={!!busy && busy !== "mine"}
          disabled={locked && busy !== "mine"}
        />
        <VersionCard
          where="GitHub"
          icon={<GitHubMark size={12} />}
          when={relativeTime(pair.mark.at)}
          words={pair.theirs.words}
          lines={versions?.theirs ?? null}
          changed={versions?.onlyTheirs ?? EMPTY}
          fallback={pair.theirs.excerpt}
          unreadable={unreadable}
          paneRef={(el) => (panes.current[1] = el)}
          onScroll={onPaneScroll(1)}
          action="Use this one"
          actionLabel="Use the GitHub version"
          onKeep={() => resolve("theirs")}
          busy={busy === "theirs"}
          faded={!!busy && busy !== "theirs"}
          disabled={locked && busy !== "theirs"}
        />
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        {/* One column, read top to bottom: what choosing a card does, then what Keep both
            does. Split left and right, the eye had to go looking for the second. */}
        <div className="flex flex-col gap-0.5 text-2xs text-ink-4">
          <span>
            Use one and the other goes to the trash. Either way, both stay in this document’s
            history.
          </span>
          <span>Keep both leaves two files — the GitHub one as {fileName(pair.theirs.path)}.</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          loading={busy === "both"}
          disabled={locked && busy !== "both"}
          onClick={() => resolve("both")}
        >
          Keep both
        </Button>
      </div>
      {failed && <div className="mt-1.5 text-2xs text-cherry">{failed}</div>}
    </section>
  );
}

const EMPTY: Set<string> = new Set();

/** The copy is already on disk beside the original (`…-from-github.md`), so name it as is. */
const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

function VersionCard({
  where,
  icon,
  when,
  words,
  lines,
  changed,
  fallback,
  unreadable,
  paneRef,
  onScroll,
  action,
  actionLabel,
  onKeep,
  busy,
  faded,
  disabled,
}: VersionCardProps) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col rounded-md border border-line bg-paper-2 p-2.5 transition-opacity",
        faded && "opacity-40",
      )}
    >
      <div className="flex h-4 items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs leading-none font-medium">
          {icon}
          {where}
        </span>
        <span className="font-mono text-2xs leading-none text-ink-4">
          {when} · {words}w
        </span>
      </div>
      <div
        ref={paneRef}
        onScroll={onScroll}
        className="mt-2 max-h-72 min-h-24 overflow-auto rounded-xs bg-paper p-2"
      >
        {lines ? (
          lines.map((line, i) => (
            <div
              key={i}
              className={cx(
                "border-l-2 px-1 text-xs whitespace-pre-wrap",
                // Marked by a rule as well as the tint, so it isn't told by colour alone.
                changed.has(line)
                  ? "border-warn bg-warn/20 text-ink"
                  : "border-transparent text-ink-3",
              )}
            >
              {line || "\u00a0"}
            </div>
          ))
        ) : unreadable ? (
          <p className="px-1 text-xs text-cherry">
            Couldn’t read this version. Open it from the library to see all of it.
          </p>
        ) : (
          <p className="px-1 text-xs text-ink-4">{fallback}</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-2.5 w-full justify-center"
        loading={busy}
        disabled={disabled}
        onClick={onKeep}
        aria-label={actionLabel}
      >
        {action}
      </Button>
    </div>
  );
}
