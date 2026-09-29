import { useId } from "react";
import { SectionLabel } from "@/components/ui";
import { ProjectCombobox } from "@/features/editor/components/project-combobox/project-combobox.component";
import { SourceSelect } from "@/features/editor/components/source-select/source-select.component";
import { TagInput } from "@/features/editor/components/tag-input/tag-input.component";
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
  const id = useId();

  return (
    <div className="grid grid-cols-capture gap-3">
      <div>
        <SectionLabel as="label" htmlFor={`${id}-project`} className="mb-1 text-overlay-ink-3">
          Project
        </SectionLabel>
        <ProjectCombobox
          id={`${id}-project`}
          dark
          value={form.project}
          onChange={(project) => onChange({ project })}
          projects={projects}
          placement="below"
          hint={lastProject && form.project === lastProject ? "last used" : undefined}
        />
      </div>
      <div>
        <SectionLabel as="label" htmlFor={`${id}-source`} className="mb-1 text-overlay-ink-3">
          From
        </SectionLabel>
        <SourceSelect
          id={`${id}-source`}
          dark
          value={form.source}
          onChange={(source) => onChange({ source })}
          hint={detected ? "detected" : undefined}
        />
      </div>
      <div>
        <SectionLabel as="label" htmlFor={`${id}-tags`} className="mb-1 text-overlay-ink-3">
          Tags
        </SectionLabel>
        <TagInput
          id={`${id}-tags`}
          dark
          value={form.tags}
          onChange={(t) => onChange({ tags: t })}
          suggestions={tags}
          placement="below"
        />
      </div>
    </div>
  );
}
