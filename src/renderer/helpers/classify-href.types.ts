/** What clicking a link in rendered markdown should do. */
export type LinkTarget =
  /** `#section` — a heading (or footnote) in the same document. `id` is decoded, unprefixed. */
  | { kind: "anchor"; id: string }
  /** A relative link to another markdown file, resolved to its repo-relative path. */
  | { kind: "doc"; path: string }
  /** Something the system should open: a web page or a mail draft. */
  | { kind: "external"; url: string }
  /** Anything else (a relative non-markdown file, an unknown scheme): nothing to do. */
  | { kind: "none" };
