import { IS_MAC } from "@/constants";

const MOD_ORDER = ["Control", "Alt", "Shift", "Super"] as const;
const MAC_GLYPH: Record<string, string> = { Control: "⌃", Alt: "⌥", Shift: "⇧", Super: "⌘" };
/** The keys a Mac menu draws as symbols, so ⌘↩ and ⌘⌫ read as they do in the menus. */
const MAC_KEY_GLYPH: Record<string, string> = {
  Enter: "↩",
  Return: "↩",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "Esc",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  Tab: "⇥",
};
const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Esc",
  Enter: "Return",
};

/** Punctuation by physical key, so the accelerator doesn't depend on the keyboard layout. */
const CODE_NAMES: Record<string, string> = {
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
};

const MODIFIER_KEYS = ["Control", "Alt", "Shift", "Meta", "CapsLock", "Fn"];

/** True while only modifier keys are down — the combination isn't finished yet. */
export function isModifierOnly(e: KeyboardEvent): boolean {
  return MODIFIER_KEYS.includes(e.key);
}

function keyName(e: KeyboardEvent): string | null {
  const code = e.code;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (CODE_NAMES[code]) return CODE_NAMES[code];
  if (KEY_NAMES[e.key]) return KEY_NAMES[e.key];
  if (e.key === "+") return "Plus";

  // A dead key ("Dead"), or a character Electron has no name for (⌥ on a Mac types "…").
  return e.key.length === 1 && /[\x21-\x7e]/.test(e.key) ? e.key.toUpperCase() : null;
}

/**
 * KeyboardEvent → Electron accelerator ("Control+Alt+V"), or null while only modifiers
 * are held or when the combination can't be a global shortcut.
 *
 * It must hold ⌃ or ⌘. A global shortcut takes the keys from every app: ⇧A would make
 * capital A untypeable anywhere, ⌥L is how a German keyboard types @, and ⇧⇥ — pressed to
 * leave the recorder — became the shortcut. ⌥Space and function keys are the exceptions:
 * neither types anything.
 */
export function toAccelerator(e: KeyboardEvent): string | null {
  if (isModifierOnly(e)) return null;
  const mods = [
    e.ctrlKey && "Control",
    e.altKey && "Alt",
    e.shiftKey && "Shift",
    e.metaKey && "Super",
  ].filter(Boolean) as string[];
  const key = keyName(e);
  if (!key || !mods.length) return null;
  const typesNothing = /^F\d{1,2}$/.test(key) || (key === "Space" && e.altKey);
  if (!e.ctrlKey && !e.metaKey && !typesNothing) return null;

  return [...MOD_ORDER.filter((m) => mods.includes(m)), key].join("+");
}

/** "Control+Alt+V" → "⌃⌥V" on macOS, "Ctrl+Alt+V" elsewhere. */
export function acceleratorLabel(accelerator: string): string {
  const parts = accelerator
    .split("+")
    .map((p) => (p === "CmdOrCtrl" ? (IS_MAC ? "Super" : "Control") : p === "Plus" ? "+" : p));
  if (!IS_MAC)
    return parts.map((p) => (p === "Super" ? "Win" : p === "Control" ? "Ctrl" : p)).join("+");

  return parts.map((p) => MAC_GLYPH[p] ?? MAC_KEY_GLYPH[p] ?? p).join("");
}

/** "Up / Down" → "↑ / ↓": keys that do the same job, each labelled. */
export function shortcutLabel(accelerator: string): string {
  return accelerator
    .split(" / ")
    .map((a) => acceleratorLabel(a))
    .join(" / ");
}
