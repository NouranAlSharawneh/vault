import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const INSTALL =
  "curl -fsSL https://raw.githubusercontent.com/NouranAlSharawneh/vault/main/install.sh | bash";

/** A release as GitHub returns it, trimmed to what the script reads. */
const release = (version: string, spacing: number) =>
  JSON.stringify(
    {
      tag_name: `v${version}`,
      assets: [
        `Marasca-${version}-arm64.dmg.blockmap`,
        `Marasca-${version}-x64.dmg`,
        `Marasca-${version}-arm64.dmg`,
        "SHA256SUMS.txt",
      ].map((name) => ({
        name,
        browser_download_url: `https://github.com/NouranAlSharawneh/vault/releases/download/v${version}/${name}`,
      })),
    },
    null,
    spacing,
  );

let api: Server;
let base = "";
const hits: string[] = [];

beforeAll(async () => {
  api = createServer((req, res) => {
    const url = req.url ?? "";
    hits.push(url);
    const routes: Record<string, string> = {
      "/repos/NouranAlSharawneh/vault/releases?per_page=1": `[${release("0.0.3", 2)}]`,
      "/repos/NouranAlSharawneh/vault/releases/tags/v0.0.1": release("0.0.1", 0),
      "/repos/NouranAlSharawneh/vault/releases/tags/v9.9.9": JSON.stringify({ assets: [] }),
    };
    res.setHeader("Content-Type", "application/json");
    res.statusCode = url in routes ? 200 : 404;
    res.end(routes[url] ?? "{}");
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const addr = api.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => api.close());

const printUrl = (env: Record<string, string> = {}) =>
  run("bash", ["install.sh", "--print-url"], {
    cwd: root,
    env: { ...process.env, MARASCA_API: base, ...env },
  });

describe("install.sh", () => {
  it("is valid bash", async () => {
    await expect(run("bash", ["-n", "install.sh"], { cwd: root })).resolves.toBeTruthy();
  });

  it("picks the newest release's arm64 DMG and its checksums, not the blockmap or x64", async () => {
    const { stdout } = await printUrl();
    expect(stdout.trim().split("\n")).toEqual([
      "https://github.com/NouranAlSharawneh/vault/releases/download/v0.0.3/Marasca-0.0.3-arm64.dmg",
      "https://github.com/NouranAlSharawneh/vault/releases/download/v0.0.3/SHA256SUMS.txt",
    ]);
    // The list endpoint, not /releases/latest, which hides 0.x prereleases.
    expect(hits).toContain("/repos/NouranAlSharawneh/vault/releases?per_page=1");
  });

  it("installs a pinned version with MARASCA_VERSION (with or without the v), from compact JSON", async () => {
    for (const v of ["0.0.1", "v0.0.1"]) {
      const { stdout } = await printUrl({ MARASCA_VERSION: v });
      expect(stdout).toContain("/v0.0.1/Marasca-0.0.1-arm64.dmg");
    }
  });

  it("stops with a clear message when the release has no DMG", async () => {
    await expect(printUrl({ MARASCA_VERSION: "9.9.9" })).rejects.toMatchObject({
      stderr: expect.stringContaining("No Marasca DMG"),
    });
  });

  it("stops when GitHub can't be reached or the version doesn't exist", async () => {
    await expect(printUrl({ MARASCA_VERSION: "4.0.4" })).rejects.toMatchObject({
      stderr: expect.stringContaining("Couldn't reach GitHub releases"),
    });
  });

  it("verifies the checksum and refuses a damaged download", () => {
    const script = read("install.sh");
    expect(script).toContain("shasum -a 256");
    expect(script).toMatch(/Checksum mismatch.*Nothing was installed/);
    expect(script).toContain("set -euo pipefail");
  });
});

describe("the install command is easy to find", () => {
  it("is the first section of the README, as a copyable block", () => {
    const readme = read("README.md");
    const sections = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(sections[0]).toBe("Install");
    const install = readme.slice(readme.indexOf("## Install"), readme.indexOf(`## ${sections[1]}`));
    expect(install).toContain("```bash\n" + INSTALL + "\n```");
  });

  it("is the same command in the install guide, the script header and every release's notes", () => {
    expect(read("docs/INSTALL.md")).toContain(INSTALL);
    expect(read("install.sh")).toContain(INSTALL);
    expect(read(".github/workflows/release.yml")).toContain(INSTALL);
  });
});
