import type { AuthState } from "@shared/types";

export type AuthListener = (state: AuthState) => void;

export type LaunchRoute = "main" | "onboarding";
