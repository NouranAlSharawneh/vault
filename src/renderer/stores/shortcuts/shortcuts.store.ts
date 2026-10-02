import { create } from "zustand";

interface ShortcutsSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Help ▸ Keyboard Shortcuts: asked for by the menu, ⌘/ or Settings, drawn by the app. */
export const useShortcutsSheet = create<ShortcutsSheetState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
