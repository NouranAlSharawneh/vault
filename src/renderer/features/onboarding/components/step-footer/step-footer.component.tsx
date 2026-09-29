import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import type { StepFooterProps } from "./step-footer.types";

/**
 * The foot of every setup step: Back on the left, the step's actions on the right, all at
 * the hero size. Back was a small grey link on some cards and missing its arrow on all of
 * them, the primary was `md` on two steps and `lg` on the rest, and the gap above ran
 * from mt-5 to mt-7.
 */
export function StepFooter({ onBack, children }: StepFooterProps) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {onBack ? (
        // Pulled out by its padding so the arrow starts on the card's text column.
        <Button variant="ghost" size="lg" className="-ml-4" onClick={onBack}>
          <ArrowLeft size={14} /> Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
