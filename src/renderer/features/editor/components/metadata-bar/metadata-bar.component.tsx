import { useId } from "react";
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
  const id = useId();

  // Every label is a <label> for its field: a click on "Project" focuses the project.
  return (
    <div className="grid grid-cols-metadata gap-3 border-t border-line bg-paper-2 px-5 py-3">
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
        <SectionLabel as="label" htmlFor={`${id}-project`} className="mb-1">
          Project
        </SectionLabel>
        <ProjectCombobox
          id={`${id}-project`}
          value={meta.project}
          onChange={(project) => onChange({ project })}
          projects={projects}
          hint={lastProject && meta.project === lastProject ? "last used" : undefined}
        />
      </div>
      <div>
        <SectionLabel as="label" htmlFor={`${id}-source`} className="mb-1">
          From
        </SectionLabel>
        <SourceSelect
          id={`${id}-source`}
          value={meta.source}
          onChange={(source) => onChange({ source })}
        />
      </div>
      <div>
        <SectionLabel as="label" htmlFor={`${id}-tags`} className="mb-1">
          Tags
        </SectionLabel>
        <TagInput
          id={`${id}-tags`}
          value={meta.tags}
          onChange={(t) => onChange({ tags: t })}
          suggestions={tags}
        />
      </div>
    </div>
  );
}
