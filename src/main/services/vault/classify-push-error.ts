import type { PushFailure } from "@shared/types";

export type { PushFailure };

/**
 * What a failed `git push` actually means. These used to be one bucket, so a rate limit
 * or a repo you can read but not write both told the user their token had expired and
 * sent them round a re-authorization that fixed nothing.
 */
export function classifyPushError(message: string): PushFailure {
  const msg = message.toLowerCase();
  // GitHub turning the commits away. Checked first: the message also says "rejected",
  // and the push used to rebase, try again and fail the same way, for ever.
  if (/\bgh0(01|13)\b|push declined|pre-receive hook declined|remote rejected/.test(msg)) {
    return "blocked";
  }
  // A server having a bad moment is not this machine being offline, and not a dead token.
  if (/returned error: (5\d\d|429)|\b(502|503|504)\b|secondary rate limit/.test(msg)) {
    return "other";
  }
  if (/\b401\b|authentication failed|invalid credentials|could not read username/.test(msg)) {
    return "bad-credentials";
  }
  if (/repository not found|\b404\b/.test(msg)) return "not-found";
  if (/\b403\b|permission to .* denied|write access .* not granted|forbidden/.test(msg)) {
    return "no-permission";
  }
  if (/could not resolve|network|timed out|unable to access|connection/.test(msg)) {
    return "offline";
  }

  return "other";
}
