export type RepoChoice = "new" | "local" | (string & {});

export interface RepoPickerProps {
  onDone: () => void;
}
