import { Clock, Layers, RefreshCw, Star } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Dot, ListRow, Logo, SectionLabel } from "@/components/ui";
import { COLLECTIONS } from "@/data/main.data";
import { api } from "@/lib/api";
import { INBOX_COLOR, INBOX_SLUG } from "@shared/constants";
import { projectColor } from "@shared/helpers";
import type { SidebarProps } from "./sidebar.types";

const ICONS = { all: Layers, recent: Clock, starred: Star } as const;

/** Full sidebar: collections · projects · tags (with its own filter box once there are many). */
export function Sidebar({ index, config, filter, onCollection, onProject, onTag }: SidebarProps) {
  const [tagQuery, setTagQuery] = useState("");
  const tags = (index?.tags ?? [])
    .filter((t) => !tagQuery || t.tag.includes(tagQuery.toLowerCase()))
    .slice(0, 40);
  const starred = index?.docs.filter((d) => d.starred).length ?? 0;

  return (
    <aside className="flex h-full w-57.5 shrink-0 flex-col bg-paper-2">
      <div className="flex-1 overflow-y-auto px-3 pt-1 pb-3">
        {COLLECTIONS.map((c) => {
          const Icon = ICONS[c.key];
          const active = !filter.project && filter.collection === c.key;
          const count =
            c.key === "all" ? index?.docs.length : c.key === "starred" ? starred : undefined;

          return (
            <ListRow key={c.key} selected={active} onClick={() => onCollection(c.key)}>
              {c.key === "all" ? (
                <Logo size={14} small className="text-cherry" />
              ) : (
                <Icon size={13} className="text-ink-3" />
              )}
              {c.label}
              {count !== undefined && <span className="ml-auto text-xs text-ink-4">{count}</span>}
            </ListRow>
          );
        })}

        <SectionLabel className="mt-5 mb-1 px-2">Projects</SectionLabel>
        {index?.projects.map((p) => (
          <ListRow
            key={p.slug}
            selected={filter.project === p.slug}
            onClick={() => onProject(p.slug)}
          >
            <Dot color={p.slug === INBOX_SLUG ? INBOX_COLOR : projectColor(p.slug)} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto text-xs text-ink-4">{p.count}</span>
          </ListRow>
        ))}

        <SectionLabel className="mt-5 mb-1 px-2">Tags</SectionLabel>
        {(index?.tags.length ?? 0) > 12 && (
          <input
            className="input input-sm mb-2 bg-paper-3/60"
            placeholder="filter tags…"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            aria-label="filter tags"
          />
        )}
        <div className="flex flex-wrap gap-1 px-1">
          {tags.map((t) => (
            <Chip
              key={t.tag}
              selected={filter.tags.includes(t.tag)}
              onClick={() => onTag(t.tag)}
              title={`${t.count} docs`}
            >
              #{t.tag}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 pb-3 text-xs text-ink-4">
        <span className="truncate font-mono">{config.remote ?? "local"}</span>
        <Button
          variant="ghost"
          size="sm"
          className="w-6 px-0"
          onClick={() => api("vault:rescan")}
          title="Rescan vault folder"
        >
          <RefreshCw size={11} />
        </Button>
      </div>
    </aside>
  );
}
