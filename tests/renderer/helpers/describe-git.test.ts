import { describe, expect, it } from "vitest";
import { describeGit } from "@/helpers";
import type { GitStatus } from "@shared/types";

describe("describeGit", () => {
  it("is one quiet line when git works, naming where it came from", () => {
    expect(
      describeGit({ state: "ready", version: "2.39.5", binary: "/usr/bin/git", source: "apple" }),
    ).toMatchObject({ tone: "ok", title: "git 2.39.5 is ready", body: "Apple command line tools" });
  });

  it("offers Apple's installer when git is missing, and after an update broke it", () => {
    expect(describeGit({ state: "missing" })).toMatchObject({ tone: "alert", primary: "install" });
    expect(describeGit({ state: "broken", developerDir: "/x" })).toMatchObject({
      primary: "reinstall",
    });
  });

  it("shows the exact command for the licence, since only Terminal can fix it", () => {
    expect(describeGit({ state: "license", binary: "/usr/bin/git" })).toMatchObject({
      command: "sudo xcodebuild -license accept",
      primary: null,
    });
  });

  it("names the minimum version when git is too old", () => {
    const old: GitStatus = { state: "too-old", version: "2.24.3", binary: "g", source: "apple" };
    expect(describeGit(old).title).toBe("git 2.24.3 is too old");
    expect(describeGit(old).body).toContain("2.28 or newer");
  });

  it("while installing, waits instead of asking for anything", () => {
    expect(describeGit({ state: "installing", startedAt: 0 })).toMatchObject({
      tone: "wait",
      primary: null,
      secondary: ["reopenInstaller", "recheck"],
    });
  });
});
