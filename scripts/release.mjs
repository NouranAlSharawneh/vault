#!/usr/bin/env node
/**
 * Cut a release: bump the version, commit, tag. Pushing the tag runs
 * .github/workflows/release.yml, which builds the DMG and drafts the GitHub Release.
 *
 *   npm run release -- patch        # 0.0.1 → 0.0.2 (also: minor, major, or 1.2.3)
 *   npm run release -- current      # tag the version already in package.json
 *   git push --follow-tags
 *
 * Refuses to run off main, with a dirty tree, or without a CHANGELOG section for the new
 * version, so a tag can't go out that the workflow would reject anyway.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { releaseNotes } from "./release-notes.mjs";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** The version `bump` leads to from `current`. Throws on anything it can't read. */
export function nextVersion(current, bump) {
  const m = SEMVER.exec(current);
  if (!m) throw new Error(`package.json version "${current}" is not x.y.z`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (bump === "current") return current;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "major") return `${major + 1}.0.0`;
  if (SEMVER.test(bump)) return bump;
  throw new Error(`Unknown bump "${bump}": use patch, minor, major, current or x.y.z`);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function main() {
  const bump = process.argv[2];
  if (!bump) throw new Error("usage: npm run release -- <patch|minor|major|current|x.y.z>");

  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== "main") throw new Error(`Release from main (you're on ${branch})`);
  if (git("status", "--porcelain")) throw new Error("Commit or stash your changes first");

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const version = nextVersion(pkg.version, bump);
  const tag = `v${version}`;
  if (git("tag", "--list", tag)) throw new Error(`${tag} already exists`);
  if (!releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version)) {
    throw new Error(`Add a "## [${version}] - YYYY-MM-DD" section to CHANGELOG.md first`);
  }

  if (version !== pkg.version) {
    execFileSync("npm", ["version", version, "--no-git-tag-version"], { stdio: "inherit" });
    git("add", "package.json", "package-lock.json");
    execFileSync("git", ["commit", "-m", `chore(release): ${tag}`], { stdio: "inherit" });
  }
  git("tag", "-a", tag, "-m", `Marasca ${version}`);
  console.log(`\nTagged ${tag}. Now: git push --follow-tags`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`✖ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
