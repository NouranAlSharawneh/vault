import type { TokenStatus } from "@shared/types";

/**
 * Plain English for what is stored, so "GitHub signed you out" can be understood rather
 * than guessed at. A token that expires and cannot be refreshed is the case that forces
 * a fresh authorization every time it lapses.
 */
export function describeToken(status: TokenStatus | null, now = Date.now()): string | null {
  if (!status?.present) return null;
  if (status.expiresAt === null) {
    return "This token doesn't expire — a sign-out would mean it was revoked.";
  }
  const left = status.expiresAt - now;
  const when = left <= 0 ? "has expired" : `expires in ${humanise(left)}`;

  return status.canRefresh
    ? `Token ${when}, and renews itself in the background.`
    : `Token ${when}, and there's no refresh token — you'll have to sign in again when it does.`;
}

function humanise(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);

  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)} days`;
}
