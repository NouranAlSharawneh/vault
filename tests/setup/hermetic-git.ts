// Git hooks run with GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE pointing at the repo being
// committed. Tests that spawn git would inherit them and write their throwaway repos into
// that index instead of their own, so drop every per-invocation git variable up front.
const REPO_SCOPED = [
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_WORK_TREE",
  "GIT_PREFIX",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
];
for (const key of REPO_SCOPED) delete process.env[key];
