import { cx } from "@/helpers";
import type { CardProps } from "./card.types";

export function Card({ children, className }: CardProps) {
  return (
    <div className={cx("rounded-lg border border-line bg-paper shadow-pop", className)}>
      {children}
    </div>
  );
}
