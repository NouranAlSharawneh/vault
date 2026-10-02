import type { OutlineHeading } from "./document-outline.types";

/** The headings of the rendered document, in order, for the outline. */
export function outlineOf(root: ParentNode | null): OutlineHeading[] {
  if (!root) return [];

  return [...root.querySelectorAll<HTMLElement>(".prose-doc :is(h1, h2, h3)[id]")].map((h) => ({
    id: h.id,
    text: (h.textContent ?? "").trim(),
    level: Number(h.tagName[1]) as OutlineHeading["level"],
  }));
}
