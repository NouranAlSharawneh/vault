/**
 * Mermaid pins the diagram with an inline `style="max-width: 302.4px"`. An inline style
 * beats any stylesheet rule, so the diagram ignores the width we set on its wrapper and
 * zoom appears to do nothing. Relaxing the cap to 100% hands control back to the wrapper;
 * the viewBox still carries the natural size.
 */
export function relaxMermaidWidth(svg: string): string {
  return svg.replace(/max-width:\s*[\d.]+px/i, "max-width:100%");
}
