import type { DevicePollStatus, WebFlowStatus } from "@shared/types";

/** What the web-flow card says for each state main reports. */
export const WEB_FLOW_STATUS_TEXT: Record<WebFlowStatus, string> = {
  waiting: "Waiting for you to approve in the browser…",
  exchanging: "Approved — finishing sign-in…",
  ok: "Signed in!",
  denied: "You clicked Cancel on GitHub — nothing was granted.",
  cancelled: "Cancelled.",
  timeout: "That took too long — the request expired.",
  error: "GitHub didn't let us in.",
};

/** What the device-code card says for each poll result. */
export const DEVICE_FLOW_STATUS_TEXT: Record<DevicePollStatus, string> = {
  pending: "Waiting for you to approve…",
  slow_down: "GitHub asked us to slow down — still waiting…",
  expired: "Code expired.",
  denied: "You cancelled on GitHub.",
  ok: "Approved!",
};
