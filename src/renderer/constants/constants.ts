// Renderer-only constants. Cross-process ones live in `@shared/constants`.
export const IS_MAC = navigator.platform.toLowerCase().includes("mac");
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";
export const ALT_KEY = IS_MAC ? "⌥" : "Alt";
export const CTRL_KEY = IS_MAC ? "⌃" : "Ctrl";
/** Human label for `DEFAULT_HOTKEY` (Control+Alt+V). */
export const CAPTURE_HOTKEY_LABEL = IS_MAC ? "⌃⌥V" : "Ctrl+Alt+V";
export const DONE_SCREEN_DELAY_MS = 700;
export const COPIED_FEEDBACK_MS = 1200;
export const REPO_LIST_LIMIT = 50;
export const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
export const SIDEBAR_STORAGE_KEY = "sidebar-state";
export const RECENT_DAYS = 7;
export const PALETTE_MAX_DOCS = 8;
export const PALETTE_MAX_TEXT = 5;
/** With no query the palette shows a glance at what you touched last, not a list. */
export const PALETTE_MAX_RECENT = 2;
export const SEARCH_DEBOUNCE_MS = 80;
export const CAPTURE_SAVED_FLASH_MS = 900;
export const TOAST_MS = 6000;
export const ASSET_RESOLVE_DEBOUNCE_MS = 250;
/** Diagram zoom bounds. Chromium's `zoom` reflows, so the pane scrolls when it overflows. */
export const MERMAID_ZOOM_MIN = 0.5;
export const MERMAID_ZOOM_MAX = 4;
export const MERMAID_ZOOM_STEP = 0.25;
/** Horizontal padding of the diagram pane, subtracted when fitting to width. */
export const MERMAID_PANE_PAD = 32;
