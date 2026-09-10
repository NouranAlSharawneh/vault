import { Button } from "@/components/ui";
import type { UnsavedGuardProps } from "./unsaved-guard.types";

export function UnsavedGuard({ open, onKeepEditing, onDiscard, onSave }: UnsavedGuardProps) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-ink/20 pt-24">
      <div className="w-100 animate-pop-in rounded-lg border border-line bg-paper p-5 shadow-pop">
        <div className="font-serif text-xl font-medium text-ink">Unsaved changes</div>
        <p className="mt-1 text-sm text-ink-3">
          This document hasn't been saved. Commit it, or discard it?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="subtle" onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            Discard
          </Button>
          <Button variant="primary" onClick={onSave}>
            Save &amp; commit
          </Button>
        </div>
      </div>
    </div>
  );
}
