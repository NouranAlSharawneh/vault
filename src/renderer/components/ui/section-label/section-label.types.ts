import type { ReactNode } from "react";

export interface SectionLabelProps {
  children: ReactNode;
  className?: string;
  /** A heading when the label names a section a screen reader should be able to jump to:
   *  a settings group, a sidebar section. A plain label otherwise. */
  as?: "div" | "h2" | "h3" | "label";
  id?: string;
  /** With `as="label"`: the field it names, so a click on it focuses the field. */
  htmlFor?: string;
}
