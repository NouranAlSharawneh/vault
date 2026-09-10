import type { WebFlowStatus } from "@shared/types";

export interface WebFlowProps {
  onBack: () => void;
}

export interface WebFlowState {
  status: WebFlowStatus;
  message?: string;
}
