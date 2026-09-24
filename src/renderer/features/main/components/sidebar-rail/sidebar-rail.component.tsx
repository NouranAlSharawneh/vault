import { Clock, Hash, Layers, Star } from "lucide-react";
import { Dot, ListRow, Logo } from "@/components/ui";
import { COLLECTIONS } from "@/data/main.data";
import { INBOX_COLOR, INBOX_SLUG } from "@shared/constants";
import { projectColor } from "@shared/helpers";
import type { SidebarRailProps } from "./sidebar-rail.types";

const ICONS = { all: Layers, recent: Clock, starred: Star } as const;

/** Collapsed sidebar: icons and project swatches only. */
export function SidebarRail({
  index,
  filter,
  onCollection,
  onProject,
  onExpand,
}: SidebarRailProps) {
  return (
    <aside className="flex h-full w-12 flex-col items-center bg-paper-2 px-2 pt-1">
      {COLLECTIONS.map((c) => {
        const Icon = ICONS[c.key];
        const active = !filter.project && filter.collection === c.key;

        return (
          <ListRow
            kind="rail"
            key={c.key}
            title={c.label}
            selected={active}
            onClick={() => onCollection(c.key)}
          >
            {c.key === "all" ? <Logo size={15} /> : <Icon size={14} />}
          </ListRow>
        );
      })}
      <div className="my-2 h-px w-6 bg-line" />
      {index?.projects.map((p) => (
        <ListRow
          kind="rail"
          key={p.slug}
          className="h-6"
          title={`${p.name} · ${p.count}`}
          selected={filter.project === p.slug}
          onClick={() => onProject(p.slug)}
        >
          <Dot
            color={p.slug === INBOX_SLUG ? INBOX_COLOR : projectColor(p.slug)}
            size={filter.project === p.slug ? 9 : 7}
          />
        </ListRow>
      ))}
      <div className="my-2 h-px w-6 bg-line" />
      <ListRow kind="rail" title="Tags — expand sidebar (⌘\\)" onClick={onExpand}>
        <Hash size={14} />
      </ListRow>
    </aside>
  );
}
