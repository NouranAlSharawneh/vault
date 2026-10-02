import { Star } from "lucide-react";
import { useId } from "react";
import { SectionLabel } from "@/components/ui";
import { cx } from "@/helpers";
import { ProjectCombobox } from "../project-combobox/project-combobox.component";
import { SourceSelect } from "../source-select/source-select.component";
import { TagInput } from "../tag-input/tag-input.component";
import type { MetadataBarProps } from "./metadata-bar.types";

/** Project · source · tags · star — what becomes frontmatter, beside the title up top. */
export function MetadataBar({ meta, onChange, projects, tags, lastProject }: MetadataBarProps) {
  const id = useId();

  // Every label is a <label> for its field: a click on "Project" focuses the project.
  return (
    <div className="grid grid-cols-metadata gap-3 border-t border-line bg-paper-2 px-5 py-3">
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
      <div>
        <SectionLabel as="label" htmlFor={`${id}-star`} className="mb-1">
          Star
        </SectionLabel>
        {/* The star was only ever set from the main window; the draft carried the flag
            with no way to change it here. The field's own box, so it lines up. */}
        <button
          id={`${id}-star`}
          type="button"
          // Named "Star" by its label; pressed says whether it is.
          aria-pressed={meta.starred}
          title={meta.starred ? "Unstar" : "Star"}
          onClick={() => onChange({ starred: !meta.starred })}
          className="field w-8 justify-center px-0 hover:bg-paper-3"
        >
          <Star size={14} className={cx(meta.starred ? "fill-warn-2 text-warn-2" : "text-ink-3")} />
        </button>
      </div>
    </div>
  );
}
