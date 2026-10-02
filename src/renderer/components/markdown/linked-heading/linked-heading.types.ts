import type { ComponentPropsWithoutRef } from "react";

export type HeadingTag = "h1" | "h2" | "h3" | "h4";

export type LinkedHeadingProps = ComponentPropsWithoutRef<"h2"> & {
  as: HeadingTag;
  /** The document's repo-relative path, which the copied link points into. */
  docPath: string;
  /** react-markdown passes its hast node along; it is not for the DOM. */
  node?: unknown;
};
