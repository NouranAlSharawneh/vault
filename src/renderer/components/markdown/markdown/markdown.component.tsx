import { memo } from "react";
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
import { CodeBlock, PreBlock } from "../code-block/code-block.component";
import { DocImage } from "../doc-image/doc-image.component";
import type { MarkdownProps } from "./markdown.types";

const REMARK: NonNullable<Options["remarkPlugins"]> = [remarkGfm, remarkAlert];

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
}: MarkdownProps) {
  const follow = (e: MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
    e.preventDefault();
    if (!href) return;
    const target = classifyHref(href, docPath);
    switch (target.kind) {
      case "anchor": {
        const root = e.currentTarget.closest(".prose-doc");
        if (root) scrollToAnchor(root, target.id, MARKDOWN_ID_PREFIX);
        break;
      }
      case "doc":
        onOpenDoc?.(target.path);
        break;
      case "external":
        fire(api("app:openExternal", target.url), "Couldn’t open that link");
        break;
      case "none":
        break;
    }
  };

  return (
    <div className={cx("prose-doc", className)}>
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={{
          code: CodeBlock,
          pre: PreBlock,
          img: (props) => <DocImage {...props} docPath={docPath} />,
          // `id` is kept so a footnote's "back to text" link has somewhere to land.
          a: ({ href, id, children }) => (
            <a href={href} id={id} onClick={(e) => follow(e, href)}>
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
