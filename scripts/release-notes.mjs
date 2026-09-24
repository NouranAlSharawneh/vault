#!/usr/bin/env node
/**
 * Prints the CHANGELOG section for one version: the release body on GitHub.
 *
 *   node scripts/release-notes.mjs 0.0.1   # or v0.0.1
 *
 * Exits non-zero when the version has no section, so a release can't go out without notes.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The body under `## [version]` (up to the next `## `), trimmed; null when missing. */
export function releaseNotes(changelog, version) {
  const v = version.replace(/^v/, "");
  const lines = changelog.split("\n");
  const start = lines.findIndex((l) =>
    new RegExp(`^## \\[?${v.replace(/\./g, "\\.")}\\]?(\\s|$)`).test(l),
  );
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();

  return body || null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: release-notes.mjs <version>");
    process.exit(2);
  }
  const notes = releaseNotes(
    readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
    version,
  );
  if (!notes) {
    console.error(`CHANGELOG.md has no section for ${version}`);
    process.exit(1);
  }
  process.stdout.write(notes + "\n");
}
