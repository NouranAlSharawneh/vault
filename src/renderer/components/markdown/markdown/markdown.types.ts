export interface MarkdownProps {
  source: string;
  /** Repo-relative path of the doc; images and media in it resolve against its folder. */
  docPath?: string;
  className?: string;
}
