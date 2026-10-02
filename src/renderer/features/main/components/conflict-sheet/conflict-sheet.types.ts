import type { ReactNode } from "react";
import type { ConflictPair } from "@shared/types";

export interface ConflictSheetProps {
  onClose: () => void;
}

export interface VersionCardProps {
  /** "This Mac" or "GitHub" — never "mine"/"theirs", which readers reliably invert. */
  where: string;
  icon: ReactNode;
  when: string;
  words: number;
  /** The whole body, so the choice is made on the text rather than on a preview. */
  lines: string[] | null;
  /** Lines the other version does not have; tinted so the difference is findable. */
  changed: Set<string>;
  fallback: string;
  /** The version couldn't be read, so the fallback excerpt would pass for the whole text. */
  unreadable?: boolean;
  /** The primary action on this card: keep this version. */
  action: string;
  /** What the action does, said in full: the two cards share the same visible label. */
  actionLabel: string;
  onKeep: () => void;
  busy?: boolean;
  /** Dims the card while the other one is being kept. */
  faded?: boolean;
  /** Nothing can be chosen here right now: an answer is on its way somewhere. */
  disabled?: boolean;
  /** Registers this card's scrolling pane, and reports it moving, so the pair can move together. */
  paneRef: (el: HTMLDivElement | null) => void;
  onScroll: () => void;
}

export interface ConflictRowProps {
  pair: ConflictPair;
  onResolved: () => void;
  /** Which row is being settled, if any: one at a time across the whole sheet. */
  settling: string | null;
  onSettling: (path: string | null) => void;
}
