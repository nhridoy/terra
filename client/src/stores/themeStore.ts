import { create } from "zustand";

export type Theme =
  | "dark"
  | "light"
  | "midnight"
  | "dracula"
  | "nord"
  | "solarized"
  | "monokai"
  | "tokyo-night"
  | "gruvbox"
  | "catppuccin"
  | "rose-pine"
  | "onedark";

export const themes: Record<
  Theme,
  { name: string; colors: { background: string } }
> = {
  dark: { name: "Dark", colors: { background: "#0a0a0f" } },
  light: { name: "Light", colors: { background: "#ffffff" } },
  midnight: { name: "Midnight", colors: { background: "#0d1117" } },
  dracula: { name: "Dracula", colors: { background: "#282a36" } },
  nord: { name: "Nord", colors: { background: "#2e3440" } },
  solarized: { name: "Solarized", colors: { background: "#002b36" } },
  monokai: { name: "Monokai", colors: { background: "#272822" } },
  "tokyo-night": { name: "Tokyo Night", colors: { background: "#1a1b26" } },
  gruvbox: { name: "Gruvbox", colors: { background: "#282828" } },
  catppuccin: { name: "Catppuccin", colors: { background: "#1e1e2e" } },
  "rose-pine": { name: "Rose Pine", colors: { background: "#191724" } },
  onedark: { name: "One Dark", colors: { background: "#282c34" } },
};

export const useThemeStore = create<{
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}>((set) => ({
  currentTheme: "dark",
  setTheme: (theme) => set({ currentTheme: theme }),
}));
