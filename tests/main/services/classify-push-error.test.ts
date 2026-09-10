import { describe, expect, it } from "vitest";
import { classifyPushError } from "@main/services/vault/classify-push-error";

describe("classifyPushError", () => {
  it("calls a dead token bad-credentials", () => {
    expect(
      classifyPushError("fatal: Authentication failed for 'https://github.com/n/v.git/'"),
    ).toBe("bad-credentials");
    expect(classifyPushError("remote: Invalid credentials\nfatal: 401")).toBe("bad-credentials");
    expect(classifyPushError("could not read Username for 'https://github.com'")).toBe(
      "bad-credentials",
    );
  });

  it("keeps a live token that lacks write access separate from a dead one", () => {
    // This must NOT read as "sign in again" — re-authorizing would fix nothing.
    expect(classifyPushError("remote: Permission to n/v.git denied to someone.")).toBe(
      "no-permission",
    );
    expect(classifyPushError("remote: Write access to repository not granted.")).toBe(
      "no-permission",
    );
    expect(classifyPushError("The requested URL returned error: 403")).toBe("no-permission");
  });

  it("recognises being offline", () => {
    expect(
      classifyPushError("fatal: unable to access 'https://github.com/': Could not resolve host"),
    ).toBe("offline");
    expect(classifyPushError("Connection timed out")).toBe("offline");
  });

  it("leaves everything else alone so it keeps retrying", () => {
    expect(classifyPushError("Updates were rejected because the remote contains work")).toBe(
      "other",
    );
    // A commit message that merely mentions the word must not trip the auth path.
    expect(classifyPushError("error: failed to push some refs")).toBe("other");
  });
});
