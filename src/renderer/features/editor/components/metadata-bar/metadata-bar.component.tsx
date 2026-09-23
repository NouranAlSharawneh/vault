import { SectionLabel } from "@/components/ui";
import { ProjectCombobox } from "../project-combobox/project-combobox.component";
import { SourceSelect } from "../source-select/source-select.component";
import { TagInput } from "../tag-input/tag-input.component";
import type { MetadataBarProps } from "./metadata-bar.types";

/** Title · project · source · tags — everything that becomes frontmatter. */
export function MetadataBar({
  meta,
  inferredTitle,
  onChange,
  projects,
  tags,
  lastProject,
}: MetadataBarProps) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_0.7fr_1.4fr] gap-3 border-t border-line bg-paper-2 px-5 py-3">
      <label className="block">
        <SectionLabel className="mb-1">Title</SectionLabel>
        <div className="relative">
          <input
            className="input pr-20"
            value={meta.title}
            placeholder={inferredTitle || "Untitled"}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label="Title"
          />
          {!meta.title && inferredTitle && (
            <span className="pointer-events-none absolute top-2 right-2.5 text-2xs text-ink-4">
              from heading
            </span>
          )}
        </div>
      </label>
      <div>
        <SectionLabel className="mb-1">Project</SectionLabel>
        <ProjectCombobox
          value={meta.project}
          onChange={(project) => onChange({ project })}
          projects={projects}
          hint={lastProject && meta.project === lastProject ? "last used" : undefined}
        />
      </div>
      <div>
        <SectionLabel className="mb-1">From</SectionLabel>
        <SourceSelect value={meta.source} onChange={(source) => onChange({ source })} />
      </div>
      <div>
        <SectionLabel className="mb-1">Tags</SectionLabel>
        <TagInput value={meta.tags} onChange={(t) => onChange({ tags: t })} suggestions={tags} />
      </div>
    </div>
  );
}
