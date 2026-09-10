export type TokenProvider = () => string | null;

export interface ChangedFile {
  status: string;
  path: string;
  oldPath?: string;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}
