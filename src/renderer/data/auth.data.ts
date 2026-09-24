import type { DevicePollStatus } from "@shared/types";

/** What the device-code card says for each poll result. */
export const DEVICE_FLOW_STATUS_TEXT: Record<DevicePollStatus, string> = {
  pending: "Waiting for you to approve…",
  slow_down: "GitHub asked us to slow down — still waiting…",
  expired: "Code expired.",
  denied: "You cancelled on GitHub.",
  ok: "Approved!",
  error: "Lost touch with GitHub — no longer waiting on this code.",
};
