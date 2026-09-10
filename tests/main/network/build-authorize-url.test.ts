import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "@main/network/github/build-authorize-url";

describe("buildAuthorizeUrl", () => {
  it("targets GitHub's authorize page with every required param", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "abc123",
        redirectUri: "http://127.0.0.1:47831/callback",
        state: "xyz",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("abc123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:47831/callback");
    expect(url.searchParams.get("scope")).toBe("repo");
    expect(url.searchParams.get("state")).toBe("xyz");
  });
});
