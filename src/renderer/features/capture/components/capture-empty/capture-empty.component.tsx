import { ClipboardX } from "lucide-react";
import { Button, Kbd } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import type { CaptureEmptyProps } from "./capture-empty.types";

export function CaptureEmpty({ onOpenEditor }: CaptureEmptyProps) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <ClipboardX size={22} className="text-overlay-ink-3" />
      <div className="mt-3 text-md text-overlay-ink">Clipboard is empty</div>
      <div className="mt-1 text-sm text-overlay-ink-3">
        Copy some markdown, then press the hotkey again.
      </div>
      <div className="mt-5">
        <Button
          variant="ghost"
          className="text-overlay-ink-2 hover:bg-overlay-3 hover:text-overlay-ink"
          onClick={onOpenEditor}
        >
          Write one instead <Kbd dark>{MOD_KEY}E</Kbd>
        </Button>
      </div>
    </div>
  );
}
