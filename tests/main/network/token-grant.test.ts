import { describe, expect, it } from "vitest";
import { toCredentials } from "@main/network/github/token-grant";

const NOW = 1_760_000_000_000;

describe("toCredentials", () => {
  it("keeps the refresh token and turns expiry seconds into a deadline", () => {
    const creds = toCredentials(
      {
        access_token: "gho_new",
        refresh_token: "ghr_new",
        expires_in: 28_800,
        refresh_token_expires_in: 15_811_200,
      },
      NOW,
    );
    expect(creds).toEqual({
      accessToken: "gho_new",
      refreshToken: "ghr_new",
      expiresAt: NOW + 28_800_000,
      refreshExpiresAt: NOW + 15_811_200_000,
    });
  });

  it("marks a non-expiring token as such rather than inventing a deadline", () => {
    // A classic OAuth App token never expires and comes with no refresh token.
    expect(toCredentials({ access_token: "gho_forever" }, NOW)).toEqual({
      accessToken: "gho_forever",
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
    });
  });
});
