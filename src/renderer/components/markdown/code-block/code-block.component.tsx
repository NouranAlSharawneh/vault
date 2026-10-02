import { Check, Copy } from "lucide-react";
import { isValidElement, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { COPIED_FEEDBACK_MS } from "@/constants";
import { useToast } from "@/stores/toast";
import { MermaidBlock } from "../mermaid-block/mermaid-block.component";
import type { CodeBlockProps, PreBlockProps } from "./code-block.types";
import { fenceLanguage } from "./fence-language";

type CodeChild = { className?: string; children?: unknown };

const mermaidSource = (child: unknown): string | null => {
  if (!isValidElement<CodeChild>(child)) return null;
  if (!/language-mermaid/.test(child.props.className ?? "")) return null;

  return String(child.props.children ?? "").replace(/\n$/, "");
};

/**
 * react-markdown `pre` renderer: a ```mermaid fence becomes a diagram; any other fence
 * gets its language named in the corner and a Copy button beside it — shown on hover or
 * when tabbed to — so a command can be taken out without selecting it by hand.
 */
export function PreBlock({ children, ...rest }: PreBlockProps) {
  const code = mermaidSource(children);
  if (code !== null) return <MermaidBlock code={code} />;

  return (
    <CopyablePre language={fenceLanguage(children)} {...rest}>
      {children as React.ReactNode}
    </CopyablePre>
  );
}

function CopyablePre({
  language,
  children,
  ...rest
}: Omit<PreBlockProps, "children"> & { language: string | null; children: React.ReactNode }) {
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(t);
  }, [copied]);

  const copy = () => {
    const text = pre.current?.textContent ?? "";
    navigator.clipboard.writeText(text.replace(/\n$/, "")).then(
      () => setCopied(true),
      () => useToast.getState().show("Couldn’t copy the code"),
    );
  };

  return (
    <div className="group/code relative">
      <pre ref={pre} {...rest}>
        {children}
      </pre>
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5">
        {language && (
          <span className="font-sans text-2xs text-overlay-ink-3 select-none">{language}</span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-overlay-ink-2 opacity-0 group-hover/code:opacity-100 hover:bg-overlay-3 hover:text-overlay-ink focus-visible:opacity-100"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
          tooltip={copied ? "Copied" : "Copy"}
          tooltipAlign="end"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </Button>
      </div>
    </div>
  );
}

/** Inline and fenced code stay as highlighted `<code>`. */
export function CodeBlock({ className, children, ...rest }: CodeBlockProps) {
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}
