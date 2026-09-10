import type { AuthState } from "@shared/types";

export type AuthListener = (state: AuthState) => void;
