import { Clock, Layers, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Dot, ListRow, Logo, SectionLabel } from "@/components/ui";
import { COLLECTIONS, SIDEBAR_TAG_LIMIT } from "@/data/main.data";
import { plural } from "@/helpers";
import { INBOX_COLOR, INBOX_SLUG } from "@shared/constants";
import { projectColor } from "@shared/helpers";
import { VaultFooter } from "../vault-footer/vault-footer.component";
import type { SidebarProps } from "./sidebar.types";

const ICONS = { all: Layers, recent: Clock, starred: Star } as const;

function Count({ n }: { n: number | undefined }) {
  if (n === undefined) return null;

  return (
    <span className="ml-auto shrink-0 text-xs text-ink-4 tabular-nums">{n.toLocaleString()}</span>
  );
}

/** Full sidebar: collections · projects · tags (with its own filter box once there are many) · the vault. */
export function Sidebar({
  index,
  config,
  filter,
  trashCount = 0,
  onCollection,
  onProject,
  onTag,
  onSettings,
}: SidebarProps) {
  const [tagQuery, setTagQuery] = useState("");
  const [allTags, setAllTags] = useState(false);
  // Tags keep their case, so the match must not care about it: typing "react" found no #React.
  const q = tagQuery.trim().toLowerCase();
  const matching = (index?.tags ?? []).filter((t) => !q || t.tag.toLowerCase().includes(q));
  // A cut-off list says there is more, and never hides a tag that is filtering the list.
  const shown = allTags || q ? matching : matching.slice(0, SIDEBAR_TAG_LIMIT);
  const hiddenActive = matching.filter(
    (t) => filter.tags.includes(t.tag) && !shown.some((s) => s.tag === t.tag),
  );
  const tags = [...shown, ...hiddenActive];
  const more = matching.length - tags.length;
  const starred = index?.docs.filter((d) => d.starred).length ?? 0;
  const inTrash = filter.collection === "trash";

  return (
    <nav aria-label="Library" className="flex h-full w-57.5 shrink-0 flex-col bg-paper-2">
      <div className="flex-1 overflow-y-auto px-3 pt-1.5 pb-3">
        {COLLECTIONS.map((c) => {
          const Icon = ICONS[c.key];
          const active = !filter.project && filter.collection === c.key;
          const count =
            c.key === "all" ? index?.docs.length : c.key === "starred" ? starred : undefined;

          return (
            <ListRow key={c.key} selected={active} onClick={() => onCollection(c.key)}>
              {c.key === "all" ? (
                <Logo size={14} decorative />
              ) : (
                <Icon size={14} className="text-ink-3" />
              )}
              {c.label}
              <Count n={count} />
            </ListRow>
          );
        })}

        <SectionLabel as="h2" className="mt-5 mb-1 px-2">
          Projects
        </SectionLabel>
        {index?.projects.map((p) => (
          <ListRow
            key={p.slug}
            selected={filter.project === p.slug}
            onClick={() => onProject(p.slug)}
            title={p.name}
          >
            <Dot color={p.slug === INBOX_SLUG ? INBOX_COLOR : projectColor(p.slug)} />
            <span className="truncate">{p.name}</span>
            <Count n={p.count} />
          </ListRow>
        ))}

        <SectionLabel as="h2" className="mt-5 mb-1 px-2">
          Tags
        </SectionLabel>
        {(index?.tags.length ?? 0) > 12 && (
          <input
            className="input input-sm mb-2 bg-paper-3/60"
            placeholder="filter tags…"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Escape" && tagQuery && (e.preventDefault(), setTagQuery(""))
            }
            aria-label="Filter tags"
          />
        )}
        <div className="flex flex-wrap gap-1 px-2">
          {tags.map((t) => (
            <Chip
              key={t.tag}
              selected={filter.tags.includes(t.tag)}
              onClick={() => onTag(t.tag)}
              title={plural(t.count, "doc")}
              aria-label={`#${t.tag}, ${plural(t.count, "doc")}`}
            >
              #{t.tag}
            </Chip>
          ))}
        </div>
        {more > 0 && (
          <Button variant="subtle" className="mt-2 px-2" onClick={() => setAllTags(true)}>
            Show all {matching.length} tags
          </Button>
        )}
      </div>
      {/* Only once something is in it: deleted documents had no way back from the library
          once the Undo toast was gone, and nothing showed that the list was the trash. */}
      {(trashCount > 0 || inTrash) && (
        <div className="px-3 pb-1">
          <ListRow selected={inTrash} onClick={() => onCollection("trash")}>
            <Trash2 size={14} className="text-ink-3" />
            Trash
            <Count n={trashCount} />
          </ListRow>
        </div>
      )}
      <VaultFooter config={config} onSettings={onSettings} />
    </nav>
  );
}
