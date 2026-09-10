import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cx } from "@/helpers";
import { api } from "@/lib/api";
import { CodeBlock, PreBlock } from "../code-block/code-block.component";
import { DocImage } from "../doc-image/doc-image.component";
import type { MarkdownProps } from "./markdown.types";

const REMARK = [remarkGfm];
const REHYPE = [rehypeHighlight];

/**
 * Rendered markdown (GFM, highlighted code, Mermaid, vault images). External links open in
 * the system browser.
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
                if (href) void api("app:openExternal", href);
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
