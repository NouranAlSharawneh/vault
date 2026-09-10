import { defaultSchema } from "rehype-sanitize";

/** Class names `remark-github-blockquote-alert` puts on the alert wrapper. */
const ALERT_CLASSES = [
  "markdown-alert",
  "markdown-alert-note",
  "markdown-alert-tip",
  "markdown-alert-important",
  "markdown-alert-warning",
  "markdown-alert-caution",
];

/**
 * What raw HTML in a doc is allowed to be.
 *
 * `rehype-raw` parses the HTML a README leans on — `<p align="center">`, `<picture>`,
 * badge `<img>`s, `<div>`s — and without this every one of those tags would be a live
 * script vector for whatever happened to be on the clipboard. The base is
 * `hast-util-sanitize`'s GitHub allowlist; three things are added on top:
 *
 * - `<svg>`/`<path>`, for the octicons the alert plugin emits
 * - the alert class names, so the CSS below can find them
 * - `<video>`, which GitHub permits in a README
 *
 * And one thing is taken away: `<source>`. GitHub READMEs use
 * `<picture><source media="(prefers-color-scheme: dark)">` to swap in a dark-mode asset,
 * and that media query follows the OS, not Vault — which is light-only. Honouring it would
 * drop a light-stroked, transparent-background SVG onto cream paper and make it invisible.
 * Sanitize unwraps a disallowed element rather than deleting its subtree, so removing
 * `<source>` leaves the `<picture>` holding just its `<img>` fallback: the light variant,
 * by GitHub convention. Put `<source>` back when Vault grows a dark theme.
 *
 * `style` stays out, exactly as GitHub leaves it out: a `<div style="display:flex">`
 * stacks here because it stacks on github.com. The preview is a promise about what the
 * pushed file looks like, and a preview that renders better than the real thing breaks it.
 */
export const MARKDOWN_SANITIZE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []).filter((tag) => tag !== "source"),
    "svg",
    "path",
    "video",
  ],
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), ["className", ...ALERT_CLASSES]],
    p: [...(defaultSchema.attributes?.p ?? []), ["className", "markdown-alert-title"]],
    svg: ["viewBox", "width", "height", "ariaHidden", ["className", "octicon"]],
    path: ["d", "fillRule", "clipRule"],
    video: ["src", "poster", "controls", "width", "height"],
  },
};
