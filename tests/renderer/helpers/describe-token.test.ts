import { describe, expect, it } from "vitest";
import { describeToken } from "@/helpers";

const NOW = Date.parse("2026-09-11T12:00:00Z");
const hours = (n: number) => NOW + n * 3_600_000;

describe("describeToken", () => {
  it("says nothing when there is nothing stored", () => {
    expect(describeToken(null)).toBeNull();
    expect(describeToken({ present: false, expiresAt: null, canRefresh: false })).toBeNull();
  });

  it("distinguishes a token that never expires — a sign-out there means revoked", () => {
    expect(describeToken({ present: true, expiresAt: null, canRefresh: false }, NOW)).toBe(
      "This token doesn't expire — a sign-out would mean it was revoked.",
    );
  });

  it("warns when an expiring token has no way to renew itself", () => {
    // This is the case that forces a fresh authorization every single lapse.
    expect(describeToken({ present: true, expiresAt: hours(7), canRefresh: false }, NOW)).toBe(
      "Token expires in 7h, and there's no refresh token — you'll have to sign in again when it does.",
    );
  });

  it("is reassuring when it can renew itself", () => {
    expect(describeToken({ present: true, expiresAt: hours(7), canRefresh: true }, NOW)).toBe(
      "Token expires in 7h, and renews itself in the background.",
    );
  });

  it("reports an already-dead token as expired rather than a negative countdown", () => {
    expect(describeToken({ present: true, expiresAt: hours(-3), canRefresh: true }, NOW)).toContain(
      "has expired",
    );
  });

  it("scales the units", () => {
    expect(
      describeToken({ present: true, expiresAt: NOW + 300_000, canRefresh: true }, NOW),
    ).toContain("5 min");
    expect(
      describeToken({ present: true, expiresAt: hours(24 * 30), canRefresh: true }, NOW),
    ).toContain("30 days");
  });
});
