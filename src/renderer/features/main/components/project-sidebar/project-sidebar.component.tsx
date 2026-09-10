import { RefreshCw } from "lucide-react";
import { INBOX_COLOR, INBOX_SLUG } from "@shared/constants";
import { projectColor } from "@shared/helpers";
import { Button, Dot, ListRow, Logo, SectionLabel } from "@/components/ui";
import { api } from "@/lib/api";
import type { ProjectSidebarProps } from "./project-sidebar.types";

export function ProjectSidebar({ index, config, project, onSelect }: ProjectSidebarProps) {
  return (
    <aside className="flex w-57.5 shrink-0 flex-col border-r border-line bg-paper-2">
      <div className="h-12 shrink-0 drag" />
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <ListRow selected={!project} onClick={() => onSelect(null)}>
          <Logo size={14} small className="text-cherry" /> All documents
          <span className="ml-auto text-xs text-ink-4">{index?.docs.length ?? 0}</span>
        </ListRow>
        <SectionLabel className="mt-5 mb-1 px-2">Projects</SectionLabel>
        {index?.projects.map((p) => (
          <ListRow key={p.slug} selected={project === p.slug} onClick={() => onSelect(p.slug)}>
            <Dot color={p.slug === INBOX_SLUG ? INBOX_COLOR : projectColor(p.slug)} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto text-xs text-ink-4">{p.count}</span>
          </ListRow>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line p-3 text-xs text-ink-4">
        <span className="truncate font-mono">{config.remote ?? "local"}</span>
        <Button
          variant="ghost"
          size="sm"
          className="w-6 px-0"
          onClick={() => api("vault:rescan")}
          title="Rescan"
        >
          <RefreshCw size={11} />
        </Button>
      </div>
    </aside>
  );
}
