import type { DocContent } from "@shared/types";
import type { ReaderView } from "../../../../main.types";

export interface ReaderBodyProps {
  doc: DocContent;
  view: ReaderView;
  trashed?: boolean;
  onOpenDoc?: (path: string, hash?: string) => void;
}
