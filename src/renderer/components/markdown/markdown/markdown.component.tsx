import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import { MARKDOWN_SANITIZE_SCHEMA } from "@/data/markdown.data";
import { cx } from "@/helpers";
import { api, fire } from "@/lib/api";
import { CodeBlock, PreBlock } from "../code-block/code-block.component";
import { DocImage } from "../doc-image/doc-image.component";
import type { MarkdownProps } from "./markdown.types";

const REMARK: NonNullable<Options["remarkPlugins"]> = [remarkGfm, remarkAlert];

/**
 * Order matters. `rehypeRaw` turns the raw HTML a README leans on back into real nodes,
 * `rehypeSanitize` then throws away everything GitHub wouldn't keep, and `rehypeHighlight`
 * runs last because it adds `hljs-*` classes that the sanitizer would otherwise strip.
 */
const REHYPE: NonNullable<Options["rehypePlugins"]> = [
  rehypeRaw,
  [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA],
  rehypeHighlight,
];

/**
 * Rendered markdown (GFM, raw HTML, GitHub alerts, highlighted code, Mermaid, vault
 * images). External links open in the system browser.
 */
export const Markdown = memo(function Markdown({ source, docPath = "", className }: MarkdownProps) {
  return (
    <div className={cx("prose-doc", className)}>
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={{
          code: CodeBlock,
          pre: PreBlock,
          img: (props) => <DocImage {...props} docPath={docPath} />,
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href) fire(api("app:openExternal", href), "Couldn't open that link");
              }}
            >
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
