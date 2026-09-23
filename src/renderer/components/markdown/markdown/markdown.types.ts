export interface MarkdownProps {
  source: string;
  /** Repo-relative path of the doc; images, media and relative links resolve against its folder. */
  docPath?: string;
  className?: string;
  /**
   * Called with the repo-relative path when a relative link to another `.md` file is
   * clicked. Without it (the editor preview, say) such links do nothing.
   */
  onOpenDoc?: (path: string) => void;
}
