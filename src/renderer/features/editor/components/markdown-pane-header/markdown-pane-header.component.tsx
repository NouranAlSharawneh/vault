import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button, SectionLabel } from "@/components/ui";
import { ALT_KEY, MOD_KEY } from "@/constants";
import { EDITOR_LEAVE_HINT } from "@/data/editor.data";
import { plural, readMinutes } from "@/helpers";
import type { MarkdownPaneHeaderProps } from "./markdown-pane-header.types";

/**
 * The text pane's label, on the text's own column, with how long the document is — or
 * how much is selected — and the pane's two switches: focus mode and the key list.
 * The way out of the text by keyboard shows while you are in it, not all the time.
 */
export function MarkdownPaneHeader({
  words,
  selectedWords,
  focusMode,
  onFocusMode,
  onShortcuts,
}: MarkdownPaneHeaderProps) {
  const FocusIcon = focusMode ? PanelRightOpen : PanelRightClose;

  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-3 px-measure">
      <SectionLabel>Markdown</SectionLabel>
      <div className="flex min-w-0 items-center gap-1 text-2xs text-ink-4">
        <span className="hidden truncate group-focus-within/md:inline">{EDITOR_LEAVE_HINT} ·</span>
        <span className="shrink-0 tabular-nums" aria-live="polite">
          {selectedWords
            ? `${selectedWords} of ${plural(words, "word")} selected`
            : `${plural(words, "word")} · ${readMinutes(words)} min`}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-1"
          onClick={onFocusMode}
          aria-pressed={focusMode}
          aria-label="Focus mode"
          tooltip={focusMode ? "Show the preview" : "Focus mode — hide the preview"}
          tooltipKeys={`${ALT_KEY}${MOD_KEY}P`}
          tooltipAlign="end"
        >
          <FocusIcon size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onShortcuts}
          aria-label="Keyboard shortcuts"
          tooltip="Keyboard shortcuts"
          tooltipAlign="end"
        >
          ?
        </Button>
      </div>
    </div>
  );
}
