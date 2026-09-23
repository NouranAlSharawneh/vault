import { Card, Stat } from "@/components/ui";
import { plural, pluralWord } from "@/helpers";
import type { FirstScanProps } from "./first-scan.types";
import { useFirstScan } from "./hooks/use-first-scan.hook";

export function FirstScan({ onDone }: FirstScanProps) {
  const { index, percent } = useFirstScan(onDone);
  const docs = index?.docs.length ?? 0;
  const projects = index?.projects.length ?? 0;
  const tags = index?.tags.length ?? 0;

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Reading your vault</h2>
      <p className="mt-1 text-sm text-ink-3">
        Parsing frontmatter across every file. No index file is written into the repo.
      </p>
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
    </Card>
  );
}
