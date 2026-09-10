import { ProjectCombobox } from "@/features/editor/components/project-combobox/project-combobox.component";
import { SourceSelect } from "@/features/editor/components/source-select/source-select.component";
import { TagInput } from "@/features/editor/components/tag-input/tag-input.component";
import type { CaptureFieldsProps } from "./capture-fields.types";

const Label = ({ children }: { children: string }) => (
  <div className="mb-1 text-2xs font-semibold tracking-widest text-overlay-ink-3 uppercase">
    {children}
  </div>
);

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
        <Label>Project</Label>
        <ProjectCombobox
          dark
          value={form.project}
          onChange={(project) => onChange({ project })}
          projects={projects}
          hint={lastProject && form.project === lastProject ? "last used" : undefined}
        />
      </div>
      <div>
        <Label>From</Label>
        <SourceSelect
          dark
          value={form.source}
          onChange={(source) => onChange({ source })}
          hint={detected ? "detected" : undefined}
        />
      </div>
      <div>
        <Label>Tags</Label>
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
