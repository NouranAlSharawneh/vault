import { beforeEach, describe, expect, it, vi } from "vitest";

const github = vi.hoisted(() => ({ listReleases: vi.fn() }));
vi.mock("@main/network/github", () => github);

import { NetworkError } from "@main/network/axios";
import { checkForUpdates } from "@main/services/updates/check-for-updates";

const release = (tag: string) => ({
  tag_name: tag,
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  draft: false,
  prerelease: tag.startsWith("v0."),
});

describe("checkForUpdates", () => {
  beforeEach(() => {
    github.listReleases.mockReset();
  });

  it("offers the newest release when it is newer than this build", async () => {
    github.listReleases.mockResolvedValue([
      release("v0.0.2"),
      release("v0.0.3"),
      release("v0.0.1"),
    ]);
    expect(await checkForUpdates("o/r", "0.0.1")).toEqual({
      status: "available",
      current: "0.0.1",
      latest: "0.0.3",
      url: "https://github.com/o/r/releases/tag/v0.0.3",
    });
    expect(github.listReleases).toHaveBeenCalledWith("o/r");
  });

  it("is up to date on the newest version, or on a build newer than any release", async () => {
    github.listReleases.mockResolvedValue([release("v0.0.1")]);
    expect(await checkForUpdates("o/r", "0.0.1")).toMatchObject({ status: "up-to-date" });
    expect(await checkForUpdates("o/r", "0.0.5")).toMatchObject({ status: "up-to-date" });
  });

  it("counts 0.x prereleases: every early build is one", async () => {
    github.listReleases.mockResolvedValue([release("v0.0.2")]);
    expect(await checkForUpdates("o/r", "0.0.1")).toMatchObject({ status: "available" });
  });

  it("says there is nothing to compare when there are no releases", async () => {
    github.listReleases.mockResolvedValue([]);
    expect(await checkForUpdates("o/r", "0.0.1")).toEqual({ status: "none", current: "0.0.1" });
  });

  it("treats a 404 (private repo, or none yet) as nothing to compare, not a failure", async () => {
    github.listReleases.mockImplementation(async () => {
      throw new NetworkError("Not Found", 404);
    });
    expect(await checkForUpdates("o/r", "0.0.1")).toEqual({ status: "none", current: "0.0.1" });
  });

  it("lets real failures through, so Settings can say it couldn't check", async () => {
    github.listReleases.mockImplementation(async () => {
      throw new NetworkError("Network unreachable", 0);
    });
    await expect(checkForUpdates("o/r", "0.0.1")).rejects.toThrow(/unreachable/);
  });
});
