/**
 * The natural width of an SVG document, from its `width` attribute or, failing that,
 * its viewBox. Mermaid emits `style="max-width: Npx"` and a viewBox, so this is how we
 * learn how wide a diagram actually wants to be before scaling it.
 */
export function svgIntrinsicWidth(svg: string | null): number | null {
  if (!svg) return null;
  const head = svg.slice(0, 600);
  const maxWidth = /max-width:\s*([\d.]+)px/i.exec(head);
  if (maxWidth) return Number(maxWidth[1]);
  const width = /<svg[^>]*\swidth="([\d.]+)(?:px)?"/i.exec(head);
  if (width) return Number(width[1]);
  const viewBox = /<svg[^>]*\sviewBox="[\d.-]+ [\d.-]+ ([\d.]+) [\d.]+"/i.exec(head);

  return viewBox ? Number(viewBox[1]) : null;
}
