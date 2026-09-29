export type RepoChoice = "new" | "local" | (string & {});

export interface RepoPickerProps {
  onDone: () => void;
  onBack: () => void;
  /** Open on keeping the vault on this Mac: "Start local" was chosen. */
  preferLocal?: boolean;
}
