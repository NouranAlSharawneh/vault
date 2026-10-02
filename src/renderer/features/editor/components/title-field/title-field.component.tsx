import { useId } from "react";
import type { TitleFieldProps } from "./title-field.types";

/**
 * The document's title, at the top where a title goes and in the reader's serif. It sat
 * at the bottom among the metadata while the window's header showed the file path, so
 * changing it — which renames the file — looked like a small setting. Now it says so.
 */
export function TitleField({ value, inferredTitle, onChange, renameTo }: TitleFieldProps) {
  const id = useId();
  const fromHeading = !value && !!inferredTitle;

  return (
    <div className="shrink-0 px-5 pb-2">
      <label htmlFor={id} className="sr-only">
        Title
      </label>
      <div className="flex items-baseline gap-3">
        <input
          id={id}
          // Focus is a cherry underline, not the ring: a box round a headline reads as a
          // form field; the line reads as "you're writing the title".
          className="min-w-0 flex-1 border-b-2 border-transparent bg-transparent font-serif text-3xl font-medium text-ink outline-none placeholder:text-ink-4 focus:border-cherry"
          value={value}
          placeholder={inferredTitle || "Untitled"}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={renameTo || fromHeading ? `${id}-hint` : undefined}
          spellCheck
        />
      </div>
      <div id={`${id}-hint`} className="mt-0.5 min-h-4 text-xs text-ink-4" aria-live="polite">
        {renameTo ? (
          <>
            {renameTo.kind === "rename" ? "Will rename to " : "Will move to "}
            <span className="font-mono text-ink-3">{renameTo.path}</span>
          </>
        ) : fromHeading ? (
          "From the first heading — type to name it yourself."
        ) : null}
      </div>
    </div>
  );
}
