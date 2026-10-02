import { Link2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useToast } from "@/stores/toast";
import type { LinkedHeadingProps } from "./linked-heading.types";
import { sectionLink } from "./section-link";

/**
 * A heading in the reader, with "copy a link to this section" beside it on hover (or when
 * tabbed to). Linking to a section meant finding its id in the source by hand.
 */
export function LinkedHeading({
  as: Tag,
  id,
  docPath,
  node: _node,
  children,
  ...rest
}: LinkedHeadingProps) {
  const copy = (e: MouseEvent<HTMLButtonElement>) => {
    if (!id) return;
    const text = e.currentTarget.closest(Tag)?.textContent ?? "";
    const say = useToast.getState().show;
    navigator.clipboard.writeText(sectionLink(docPath, id, text)).then(
      () => say("Copied a link to this section"),
      () => say("Couldn’t copy the link"),
    );
  };

  return (
    <Tag id={id} {...rest} className="group/heading">
      {children}
      {id && (
        <button
          type="button"
          onClick={copy}
          aria-label="Copy a link to this section"
          title="Copy a link to this section"
          className="ml-2 inline-flex size-6 items-center justify-center rounded-xs align-middle text-ink-4 opacity-0 transition-opacity group-hover/heading:opacity-100 hover:bg-paper-3 hover:text-cherry focus-visible:opacity-100"
        >
          <Link2 size={14} aria-hidden />
        </button>
      )}
    </Tag>
  );
}
