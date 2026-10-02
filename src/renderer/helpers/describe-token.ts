import { TOKEN_EXPIRY_WARN_MS } from "@shared/constants";
import type { AuthMethod, TokenStatus } from "@shared/types";

/**
 * Plain English for what is stored, so "GitHub signed you out" can be understood rather
 * than guessed at. A token that expires and cannot be refreshed is the case that forces
 * a fresh authorization every time it lapses.
 */
export function describeToken(
  status: TokenStatus | null,
  now = Date.now(),
  method: AuthMethod | null = null,
): string | null {
  if (!status?.present) return null;
  if (status.expiresAt === null) {
    // A pasted token's expiry is set on GitHub and never told to Marasca. Fine-grained
    // tokens do expire; saying this one doesn't was a promise nobody could keep.
    if (method === "pat")
      return "Personal access token. Its expiry is set on GitHub — when it lapses, paste a new one.";

    return "This token doesn't expire — a sign-out would mean it was revoked.";
  }
  const left = status.expiresAt - now;
  const when = left <= 0 ? "has expired" : `expires in ${humanise(left)}`;
  // Read from GitHub's answer: a pasted token says when it lapses on every request.
  if (method === "pat")
    return `Personal access token — ${when}. Paste a new one on GitHub before then.`;

  return status.canRefresh
    ? `Token ${when}, and renews itself in the background.`
    : `Token ${when}, and there's no refresh token — you'll have to sign in again when it does.`;
}

/**
 * A warning while there is still time to act: a token that can't renew itself and lapses
 * within the week. Pushes used to simply stop the day it expired.
 */
export function tokenExpiryWarning(status: TokenStatus | null, now = Date.now()): string | null {
  if (!status?.present || status.expiresAt === null || status.canRefresh) return null;
  const left = status.expiresAt - now;
  if (left > TOKEN_EXPIRY_WARN_MS) return null;

  return left <= 0
    ? "Your GitHub token has expired. Nothing is pushed until you paste a new one."
    : `Your GitHub token expires in ${humanise(left)}. Make a new one on GitHub and paste it here before then.`;
}

function humanise(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);

  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)} days`;
}
