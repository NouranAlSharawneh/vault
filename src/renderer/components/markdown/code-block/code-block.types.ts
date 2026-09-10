import type { ComponentPropsWithoutRef, ReactElement } from "react";

export type CodeBlockProps = ComponentPropsWithoutRef<"code">;

export type PreBlockProps = ComponentPropsWithoutRef<"pre"> & {
  children?: ReactElement<{ className?: string; children?: unknown }> | unknown;
};
