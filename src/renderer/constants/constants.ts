// Renderer-only constants. Cross-process ones live in `@shared/constants`.
export const IS_MAC = navigator.platform.toLowerCase().includes("mac");
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";
export const ALT_KEY = IS_MAC ? "⌥" : "Alt";
export const DONE_SCREEN_DELAY_MS = 700;
export const COPIED_FEEDBACK_MS = 1200;
export const REPO_LIST_LIMIT = 50;
export const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
export const SIDEBAR_STORAGE_KEY = "sidebar-state";
export const RECENT_DAYS = 7;
export const PALETTE_MAX_DOCS = 8;
export const PALETTE_MAX_TEXT = 5;
export const SEARCH_DEBOUNCE_MS = 80;
