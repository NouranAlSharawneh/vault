import { ProjectCombobox } from "@/features/editor/components/project-combobox/project-combobox.component";
import { SourceSelect } from "@/features/editor/components/source-select/source-select.component";
import { TagInput } from "@/features/editor/components/tag-input/tag-input.component";
import { SectionLabel } from "@/components/ui";
import type { CaptureFieldsProps } from "./capture-fields.types";

/** Project · From · Tags — the same controls as the editor, on the dark surface. */
export function CaptureFields({
  form,
  onChange,
  projects,
  tags,
  lastProject,
  detected,
}: CaptureFieldsProps) {
  return (
    <div className="grid grid-cols-[1fr_0.8fr_1.4fr] gap-3">
      <div>
        <SectionLabel className="mb-1 text-overlay-ink-3">Project</SectionLabel>
        <ProjectCombobox
          dark
          value={form.project}
          onChange={(project) => onChange({ project })}
          projects={projects}
          hint={lastProject && form.project === lastProject ? "last used" : undefined}
        />
      </div>
      <div>
        <SectionLabel className="mb-1 text-overlay-ink-3">From</SectionLabel>
        <SourceSelect
          dark
          value={form.source}
          onChange={(source) => onChange({ source })}
          hint={detected ? "detected" : undefined}
        />
      </div>
      <div>
        <SectionLabel className="mb-1 text-overlay-ink-3">Tags</SectionLabel>
        <TagInput
          dark
          value={form.tags}
          onChange={(t) => onChange({ tags: t })}
          suggestions={tags}
        />
      </div>
    </div>
  );
}
