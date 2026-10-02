import { memo, useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import { MARKDOWN_ID_PREFIX, MARKDOWN_SANITIZE_SCHEMA } from "@/data/markdown.data";
import { classifyHref, cx, scrollToAnchor } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useToast } from "@/stores/toast";
import { CodeBlock, PreBlock } from "../code-block/code-block.component";
import { DocImage } from "../doc-image/doc-image.component";
import { LinkedHeading } from "../linked-heading/linked-heading.component";
import type { HeadingTag } from "../linked-heading/linked-heading.types";
import type { MarkdownProps } from "./markdown.types";

const REMARK: NonNullable<Options["remarkPlugins"]> = [remarkGfm, remarkAlert];
const LINKED: HeadingTag[] = ["h1", "h2", "h3", "h4"];

/**
 * Order matters. `rehypeRaw` turns the raw HTML a README leans on back into real nodes,
 * `rehypeSlug` gives every heading (raw ones too) its GitHub id, `rehypeSanitize` then
 * throws away everything GitHub wouldn't keep — and prefixes those ids with
 * `user-content-`, exactly as GitHub does — and `rehypeHighlight` runs last because it adds
 * `hljs-*` classes that the sanitizer would otherwise strip.
 */
const REHYPE: NonNullable<Options["rehypePlugins"]> = [
  rehypeRaw,
  rehypeSlug,
  [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA],
  rehypeHighlight,
];

/**
 * Rendered markdown (GFM, raw HTML, GitHub alerts, highlighted code, Mermaid, vault
 * images). `#anchors` scroll within the document, relative `.md` links go to `onOpenDoc`
 * when there is one, and web and mail links open in the system.
 */
export const Markdown = memo(function Markdown({
  source,
  docPath = "",
  className,
  onOpenDoc,
  linkHeadings = false,
}: MarkdownProps) {
  // Read when a link is clicked, not built into the renderers below: a new callback every
  // time the index changed made new `img` and `a` components, and React threw away every
  // image and video in the document and built them again — a playing video restarted
  // whenever a push landed.
  const openDoc = useRef(onOpenDoc);
  useEffect(() => {
    openDoc.current = onOpenDoc;
  });

  const components = useMemo<NonNullable<Options["components"]>>(() => {
    const follow = (e: MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
      e.preventDefault();
      if (!href) return;
      const say = useToast.getState().show;
      const target = classifyHref(href, docPath);
      switch (target.kind) {
        case "anchor": {
          const root = e.currentTarget.closest(".prose-doc");
          if (root && !scrollToAnchor(root, target.id, MARKDOWN_ID_PREFIX))
            say("That section isn’t in this document");
          break;
        }
        case "doc":
          if (openDoc.current) openDoc.current(target.path, target.hash);
          break;
        case "external":
          fire(api("app:openExternal", target.url), "Couldn’t open that link");
          break;
        case "none":
          // Silence read as a broken click.
          say("Marasca follows links to documents and web pages — this one is neither");
          break;
      }
    };

    const headings = linkHeadings
      ? Object.fromEntries(
          LINKED.map((tag) => [
            tag,
            (props: Omit<React.ComponentProps<typeof LinkedHeading>, "as" | "docPath">) => (
              <LinkedHeading {...props} as={tag} docPath={docPath} />
            ),
          ]),
        )
      : {};

    return {
      ...headings,
      code: CodeBlock,
      pre: PreBlock,
      img: (props) => <DocImage {...props} docPath={docPath} />,
      // Everything the sanitizer kept travels with the link: `id` gives a footnote's "back to
      // text" somewhere to land, `aria-label` names that ↩ for a screen reader, `title` is
      // the tooltip the author wrote, `name` is an old-style anchor.
      a: ({ node: _node, href, children, ...rest }) => (
        <a {...rest} href={href} onClick={(e) => follow(e, href)}>
          {children}
        </a>
      ),
    };
  }, [docPath, linkHeadings]);

  return (
    <div className={cx("prose-doc", className)} dir="auto">
      <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
});
