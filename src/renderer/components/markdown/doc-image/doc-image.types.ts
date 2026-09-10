import type { ComponentPropsWithoutRef } from "react";

export type DocImageProps = ComponentPropsWithoutRef<"img"> & {
  /** Repo-relative path of the document being rendered; relative `src` resolves against it. */
  docPath: string;
};
