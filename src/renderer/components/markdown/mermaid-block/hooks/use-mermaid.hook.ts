import { useEffect, useState } from "react";
import { relaxMermaidWidth } from "@/helpers";

interface MermaidResult {
  svg: string | null;
  error: string | null;
}

let counter = 0;

/** Renders a Mermaid fence to SVG client-side; the library is loaded on first use. */
export function useMermaid(code: string): MermaidResult {
  const [result, setResult] = useState<MermaidResult>({ svg: null, error: null });

  useEffect(() => {
    let cancelled = false;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          fontFamily: "inherit",
        });
        const { svg } = await mermaid.render(`vault-mermaid-${++counter}`, code);
        if (!cancelled) setResult({ svg: relaxMermaidWidth(svg), error: null });
      })
      .catch(
        (e: unknown) =>
          !cancelled && setResult({ svg: null, error: e instanceof Error ? e.message : String(e) }),
      );

    return () => {
      cancelled = true;
    };
  }, [code]);

  return result;
}
