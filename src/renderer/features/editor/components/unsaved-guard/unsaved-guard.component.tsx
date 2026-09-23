import { Button, DialogShell } from "@/components/ui";
import type { UnsavedGuardProps } from "./unsaved-guard.types";

export function UnsavedGuard({ open, onKeepEditing, onDiscard, onSave }: UnsavedGuardProps) {
  if (!open) return null;

  return (
    <DialogShell
      label="Unsaved changes"
      // Escape means "put this away", which is keeping the document open — not asking
      // again. The editor's own Escape used to re-open this prompt on top of itself.
      onClose={onKeepEditing}
      backdropClassName="items-start bg-ink/20 pt-24"
      className="w-100 animate-pop-in rounded-lg border border-line bg-paper p-5 shadow-pop"
      initialFocus="[data-keep-editing]"
    >
      <div className="font-serif text-xl font-medium text-ink">Unsaved changes</div>
      <p className="mt-1 text-sm text-ink-3">
        You&rsquo;ll lose what you&rsquo;ve written. Save it, or discard it?
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="subtle" data-keep-editing onClick={onKeepEditing}>
          Keep editing
        </Button>
        <Button variant="outline" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save &amp; commit
        </Button>
      </div>
    </DialogShell>
  );
}
