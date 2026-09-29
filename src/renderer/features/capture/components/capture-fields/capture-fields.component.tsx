import { Plus } from "lucide-react";
import { useId } from "react";
import { Chip, SectionLabel } from "@/components/ui";
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
  shortcuts,
  suggestedTags,
  onAddTag,
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
          shortcuts={shortcuts}
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
        {/* Tags the vault already has that this clip is about: one click each, instead of
            typing them out — and remembering what they were called. */}
        {suggestedTags.length > 0 && (
          <div role="group" aria-label="Suggested tags" className="mt-1.5 flex flex-wrap gap-1">
            {suggestedTags.map((tag) => (
              <Chip key={tag} dark onClick={() => onAddTag(tag)} title={`Add #${tag}`}>
                <Plus size={10} aria-hidden />#{tag}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
