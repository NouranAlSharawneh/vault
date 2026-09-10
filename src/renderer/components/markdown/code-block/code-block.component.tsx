import { isValidElement } from "react";
import { MermaidBlock } from "../mermaid-block/mermaid-block.component";
import type { CodeBlockProps, PreBlockProps } from "./code-block.types";

const mermaidSource = (child: unknown): string | null => {
  if (!isValidElement<{ className?: string; children?: unknown }>(child)) return null;
  if (!/language-mermaid/.test(child.props.className ?? "")) return null;
  return String(child.props.children ?? "").replace(/\n$/, "");
};

/** react-markdown `pre` renderer: a ```mermaid fence becomes a diagram instead of a code block. */
export function PreBlock({ children, ...rest }: PreBlockProps) {
  const code = mermaidSource(children);
  if (code !== null) return <MermaidBlock code={code} />;
  return <pre {...rest}>{children as React.ReactNode}</pre>;
}

/** Inline and fenced code stay as highlighted `<code>`. */
export function CodeBlock({ className, children, ...rest }: CodeBlockProps) {
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}
