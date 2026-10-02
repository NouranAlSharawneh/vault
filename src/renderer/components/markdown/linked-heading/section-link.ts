import { MARKDOWN_ID_PREFIX } from "@/data/markdown.data";

/**
 * A link to one section of a document, the way it is written in another: from the vault's
 * root (`/`), which Marasca and GitHub both resolve, so it works wherever it is pasted.
 */
export function sectionLink(docPath: string, id: string, text: string): string {
  const slug = id.startsWith(MARKDOWN_ID_PREFIX) ? id.slice(MARKDOWN_ID_PREFIX.length) : id;
  const path = docPath.split("/").map(encodeURIComponent).join("/");

  return `[${text.trim()}](/${path}#${slug})`;
}
