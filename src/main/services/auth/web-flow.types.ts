import type { WebFlowStatus } from "@shared/types";

export type WebFlowReporter = (status: WebFlowStatus, message?: string) => void;
