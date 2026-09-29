import type { GitHubUser } from "@shared/types";
import { githubApi } from "../axios";
import type { RawGitHubUser } from "./github.types";

/** GitHub's answer, on every call made with a token that expires. */
const EXPIRY_HEADER = "github-authentication-token-expiration";

/**
 * "2026-10-01 00:00:00 UTC" or "2026-10-01 00:00:00 -0700" → epoch ms. Null for a token
 * that doesn't expire (no header) or a date that doesn't parse.
 */
export function parseTokenExpiry(header: unknown): number | null {
  if (typeof header !== "string" || !header.trim()) return null;
  const iso = header
    .trim()
    .replace(" ", "T")
    .replace(/\s*UTC$/i, "Z")
    .replace(/\s*([+-])(\d{2}):?(\d{2})$/, "$1$2:$3");
  const at = Date.parse(iso);

  return Number.isNaN(at) ? null : at;
}

/**
 * Who the token belongs to, and when GitHub will retire it. A pasted fine-grained token
 * has an expiry only GitHub knows; it says so in a header on every answer, and Marasca
 * used to throw that away and then describe the token as never expiring.
 */
export async function fetchUserWithExpiry(): Promise<{
  user: GitHubUser;
  expiresAt: number | null;
}> {
  const { data, headers } = await githubApi().get<RawGitHubUser>("/user");

  return {
    user: { login: data.login, name: data.name, avatarUrl: data.avatar_url },
    expiresAt: parseTokenExpiry(headers?.[EXPIRY_HEADER]),
  };
}
