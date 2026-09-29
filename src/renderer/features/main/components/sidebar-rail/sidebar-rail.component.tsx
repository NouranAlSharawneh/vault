import { Clock, Hash, Layers, Star, Trash2 } from "lucide-react";
import { Dot, ListRow, Logo } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { COLLECTIONS } from "@/data/main.data";
import { INBOX_COLOR, INBOX_SLUG } from "@shared/constants";
import { projectColor } from "@shared/helpers";
import type { SidebarRailProps } from "./sidebar-rail.types";

const ICONS = { all: Layers, recent: Clock, starred: Star } as const;

/**
 * Collapsed sidebar: icons and project swatches only. The projects scroll between the
 * collections and the tags button, which stay put: past the ninth project they, and the
 * button, used to fall off the bottom of the window.
 */
export function SidebarRail({
  index,
  filter,
  trashCount = 0,
  onCollection,
  onProject,
  onExpand,
}: SidebarRailProps) {
  const inTrash = filter.collection === "trash";

  return (
    <nav
      aria-label="Library"
      className="flex h-full w-12 shrink-0 flex-col items-center bg-paper-2 px-2 pt-1.5"
    >
      {COLLECTIONS.map((c) => {
        const Icon = ICONS[c.key];
        const active = !filter.project && filter.collection === c.key;

        return (
          <ListRow
            kind="rail"
            key={c.key}
            title={c.label}
            aria-label={c.label}
            selected={active}
            onClick={() => onCollection(c.key)}
          >
            {c.key === "all" ? <Logo size={15} /> : <Icon size={14} />}
          </ListRow>
        );
      })}
      <div className="my-2 h-px w-6 shrink-0 bg-line" />
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
        {index?.projects.map((p) => (
          <ListRow
            kind="rail"
            key={p.slug}
            title={`${p.name} · ${p.count.toLocaleString()}`}
            aria-label={p.name}
            selected={filter.project === p.slug}
            onClick={() => onProject(p.slug)}
          >
            <Dot
              color={p.slug === INBOX_SLUG ? INBOX_COLOR : projectColor(p.slug)}
              size={filter.project === p.slug ? 9 : 7}
            />
          </ListRow>
        ))}
      </div>
      <div className="my-2 h-px w-6 shrink-0 bg-line" />
      {(trashCount > 0 || inTrash) && (
        <ListRow
          kind="rail"
          title={`Trash · ${trashCount}`}
          aria-label="Trash"
          selected={inTrash}
          onClick={() => onCollection("trash")}
        >
          <Trash2 size={14} />
        </ListRow>
      )}
      <ListRow
        kind="rail"
        className="mb-2"
        title={`Tags — expand sidebar (${MOD_KEY}\\)`}
        aria-label="Show tags"
        onClick={onExpand}
      >
        <Hash size={14} />
      </ListRow>
    </nav>
  );
}
