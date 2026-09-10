// Every constant the app relies on, in one place. Types derive from these where useful.

// ---- domain ---------------------------------------------------------------------
export const SOURCES = ["claude", "chatgpt", "github", "manual", "other"] as const;
export const APP_ROUTES = ["onboarding", "main", "editor", "capture", "settings"] as const;
/** Push debounce choices offered in Settings, in ms. */
export const PUSH_DEBOUNCE_OPTIONS = [0, 3000, 10_000, 30_000] as const;
export const INBOX_SLUG = "_inbox";
export const TRASH_DIR = ".trash";
export const VAULT_DIR = ".vault";
export const README_FILE = "README.md";
export const QUERY_OPERATORS = ["project:", "tags:", "created:", "source:", "is:"] as const;

// ---- metadata block --------------------------------------------------------------
// Vault writes its metadata as a fenced YAML block at the END of the file, under a rule,
// so GitHub's preview shows the content first and the fields as a small code block below.
// Files with classic top frontmatter (Obsidian, Jekyll, older Vault) are still read.
export const META_RULE = "---";
export const META_FENCE_OPEN = "```yaml";
export const META_FENCE_CLOSE = "```";
/** `---` + blank line + fence opener; matched at the last fence in the file. */
export const META_TAIL_OPEN = /(?:^|\r?\n)---[ \t]*\r?\n[ \t]*\r?\n```yaml[ \t]*\r?\n$/;
export const META_TAIL_CLOSE = /\r?\n```[ \t]*(?:\r?\n)*$/;
export const FM_OPEN = /^\uFEFF?---[ \t]*\r?\n/;
export const FM_CLOSE = /\r?\n---[ \t]*(?:\r?\n|$)/;

// ---- indexer ---------------------------------------------------------------------
/** Folders the scanner and watcher never enter. */
export const SKIP_DIRS = new Set([".git", TRASH_DIR, VAULT_DIR, "node_modules", ".obsidian"]);
export const HEAD_BYTES = 4096;
/** Files at or below this size are read whole; larger ones read the head only until the body pass. */
export const SMALL_FILE_BYTES = HEAD_BYTES * 4;
export const PARSE_BATCH = 64;
export const BODY_BATCH = 50;
export const FS_DEBOUNCE_MS = 300;
export const SEARCH_LIMIT = 100;
export const EXCERPT_LENGTH = 200;

// ---- assets ----------------------------------------------------------------------
/** `vault://asset/<repo-relative path>` — images/media referenced from a doc, served by main. */
export const ASSET_SCHEME = "vault";
export const ASSET_HOST = "asset";
export const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);
/** MIME types main will serve from the vault; anything else is refused. */
export const ASSET_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
};

/** Folder, next to a doc's project folder, where captured images and media land. */
export const ASSETS_DIR = "assets";
/** Above this a referenced file is flagged before it goes into git for good. */
export const ASSET_WARN_BYTES = 10 * 1024 * 1024;

// ---- finding the folder relative refs belong to -----------------------------------
/** How many refs are used as probes when working out the folder on our own. */
export const ASSET_PROBE_LIMIT = 3;
/** Folders under `~` a walk is allowed to start from when nothing better is known. */
export const ASSET_HOME_ROOTS = [
  "Coding",
  "Developer",
  "Projects",
  "Documents",
  "Desktop",
  "Downloads",
  "src",
  "code",
  "repos",
  "work",
];
/** Never walked into: huge, and never where a doc's own screenshots live. */
export const ASSET_WALK_SKIP = new Set([
  ".git",
  ".next",
  ".cache",
  ".Trash",
  "Library",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "vendor",
  "venv",
  "coverage",
]);
/** The walk is a fallback, so it stays cheap: shallow, capped, and time-boxed. */
export const ASSET_WALK_DEPTH = 4;
export const ASSET_WALK_MAX_DIRS = 3000;
export const ASSET_WALK_BUDGET_MS = 1200;
/** Spotlight answers from its index in tens of ms; anything slower is treated as a miss. */
export const SPOTLIGHT_BUDGET_MS = 2500;
/** `![alt](path)` and `[text](<path with spaces>)` — group 1 is the `!`, group 2 the target (maybe in `<>`). */
export const MD_LINK_RE = /(!?)\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
/** `<img src="…">`, `<video src>`, `<source src>` — group 1 is the attribute prefix, group 2 the target. */
export const HTML_SRC_RE = /(<(?:img|video|audio|source)\b[^>]*?\ssrc=["'])([^"']+)(["'])/gi;

// ---- sync ------------------------------------------------------------------------
export const DEFAULT_PUSH_DEBOUNCE_MS = 3000;
export const PUSH_RETRY_MIN_MS = 5_000;
export const PUSH_RETRY_MAX_MS = 5 * 60_000;
export const DEFAULT_BRANCH = "main";

// ---- app defaults -------------------------------------------------------------------
/** ⌃⌥V — ⌥Space clashes with Raycast/Alfred/Spotlight on most Macs. */
export const DEFAULT_HOTKEY = "Control+Alt+V";
/** Defaults we have shipped before; a saved hotkey equal to one of these follows the current default. */
export const LEGACY_HOTKEYS = ["Alt+Space"] as const;
export const DEFAULT_VAULT_NAME = "vault";
export const APP_ID = "dev.nunu.vault";
export const GIT_IDENTITY = { name: "Vault", email: "vault@localhost" } as const;

// ---- network ----------------------------------------------------------------------
export const GITHUB_API = "https://api.github.com";
export const GITHUB_WEB = "https://github.com";
export const GITHUB_API_VERSION = "2022-11-28";
export const NETWORK_TIMEOUT_MS = 20_000;
export const USER_AGENT = "vault-desktop";
export const OAUTH_DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
export const OAUTH_SCOPE = "repo";
export const REPO_PAGE_SIZE = 100;
export const REPO_MAX_PAGES = 5;

// ---- windows ------------------------------------------------------------------------
export const MAIN_WINDOW = { width: 1280, height: 820, minWidth: 860, minHeight: 560 } as const;
export const EDITOR_WINDOW = { width: 1100, height: 760, minWidth: 720, minHeight: 480 } as const;
export const CAPTURE_WINDOW = { width: 720, height: 430 } as const;
export const TRAFFIC_LIGHTS = { x: 14, y: 16 } as const;
export const PAPER_BG = "#fdfcfa";
export const OVERLAY_BG = "#1e1d1b";

// ---- ui ------------------------------------------------------------------------------
/** Deterministic project swatches; picked by slug hash so nothing is stored. */
export const PROJECT_COLORS = [
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#10b981",
  "#ec4899",
  "#eab308",
  "#06b6d4",
  "#f43f5e",
] as const;
export const INBOX_COLOR = "#a9a49b";
export const WORDS_PER_MINUTE = 220;

// ---- oauth web flow (loopback redirect) --------------------------------------------
/** Ports tried in order for the local redirect listener; register the first one as the OAuth App callback. */
export const OAUTH_LOOPBACK_PORTS = [47831, 47832, 47833, 47834, 47835] as const;
export const OAUTH_LOOPBACK_HOST = "127.0.0.1";
export const OAUTH_CALLBACK_PATH = "/callback";
/** How long the listener waits for the browser to come back. */
export const OAUTH_TIMEOUT_MS = 5 * 60_000;
