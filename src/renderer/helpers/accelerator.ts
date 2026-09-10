import { IS_MAC } from "@/constants";

const MOD_ORDER = ["Control", "Alt", "Shift", "Super"] as const;
const MAC_GLYPH: Record<string, string> = { Control: "⌃", Alt: "⌥", Shift: "⇧", Super: "⌘" };
const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Esc",
  Enter: "Return",
};

/**
 * KeyboardEvent → Electron accelerator ("Control+Alt+V"), or null while only
 * modifiers are held. The key must come with at least one modifier.
 */
export function toAccelerator(e: KeyboardEvent): string | null {
  const mods = [
    e.ctrlKey && "Control",
    e.altKey && "Alt",
    e.shiftKey && "Shift",
    e.metaKey && "Super",
  ].filter(Boolean) as string[];
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  if (!mods.length) return null;
  const code = e.code;
  let key: string;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else key = KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return [...MOD_ORDER.filter((m) => mods.includes(m)), key].join("+");
}

/** "Control+Alt+V" → "⌃⌥V" on macOS, "Ctrl+Alt+V" elsewhere. */
export function acceleratorLabel(accelerator: string): string {
  const parts = accelerator
    .split("+")
    .map((p) => (p === "CmdOrCtrl" ? (IS_MAC ? "Super" : "Control") : p));
  if (!IS_MAC)
    return parts.map((p) => (p === "Super" ? "Win" : p === "Control" ? "Ctrl" : p)).join("+");
  return parts.map((p) => MAC_GLYPH[p] ?? p).join("");
}
