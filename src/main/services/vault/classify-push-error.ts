export type PushFailure = "offline" | "bad-credentials" | "no-permission" | "other";

/**
 * What a failed `git push` actually means. These used to be one bucket, so a rate limit
 * or a repo you can read but not write both told the user their token had expired and
 * sent them round a re-authorization that fixed nothing.
 */
export function classifyPushError(message: string): PushFailure {
  const msg = message.toLowerCase();
  if (/\b401\b|authentication failed|invalid credentials|could not read username/.test(msg)) {
    return "bad-credentials";
  }
  if (/\b403\b|permission to .* denied|write access .* not granted|forbidden/.test(msg)) {
    return "no-permission";
  }
  if (/could not resolve|network|timed out|unable to access|connection/.test(msg)) {
    return "offline";
  }
  return "other";
}
