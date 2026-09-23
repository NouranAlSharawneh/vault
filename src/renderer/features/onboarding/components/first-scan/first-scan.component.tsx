import { Button, Card, Stat } from "@/components/ui";
import { plural, pluralWord } from "@/helpers";
import type { FirstScanProps } from "./first-scan.types";
import { useFirstScan } from "./hooks/use-first-scan.hook";

export function FirstScan({ onDone, onBack }: FirstScanProps) {
  const { index, percent, error, retry } = useFirstScan(onDone);
  const docs = index?.docs.length ?? 0;
  const projects = index?.projects.length ?? 0;
  const tags = index?.tags.length ?? 0;

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Reading your vault</h2>
      <p className="mt-1 text-sm text-ink-3">
        Parsing frontmatter across every file. No index file is written into the repo.
      </p>
      {error ? (
        <div className="mt-6 rounded-md border border-line bg-paper-2 p-3 text-sm">
          <div className="text-cherry">Couldn’t read the vault folder.</div>
          <div className="mt-1 text-xs text-ink-3">{error}</div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <Button variant="link" onClick={retry}>
              Try again
            </Button>
            <Button variant="subtle" onClick={onBack}>
              Choose a different folder
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-paper-3">
            <div
              className="h-full bg-cherry transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat value={docs} label={pluralWord(docs, "document")} />
            <Stat value={projects} label={pluralWord(projects, "project")} />
            <Stat value={tags} label={pluralWord(tags, "tag")} />
          </div>
          {!!index?.orphans && (
            <div className="mt-3 text-center text-xs text-ink-3">
              {plural(index.orphans, "file")} without frontmatter — listed under Inbox until you tag
              them.
            </div>
          )}
        </>
      )}
    </Card>
  );
}
