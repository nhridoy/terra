import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";

export type Theme =
  | "dark"
  | "slate"
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

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textSecondary: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySubtle: string;
  primaryLight: string;
  primaryLighter: string;
  primaryText: string;
  danger: string;
  dangerHover: string;
  dangerActive: string;
  dangerSubtle: string;
  dangerLight: string;
  dangerText: string;
}

export const themes: Record<Theme, { name: string; colors: ThemeColors }> = {
  dark: {
    name: "Dark",
    colors: {
      background: "#000000",
      surface: "#0a0a0a",
      surfaceHover: "#171717",
      border: "#262626",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      textSubtle: "#71717a",
      textSecondary: "#d4d4d8",
      primary: "#fafafa",
      primaryHover: "#e4e4e7",
      primaryActive: "#d4d4d8",
      primarySubtle: "#27272a",
      primaryLight: "#fafafa",
      primaryLighter: "#fafafa",
      primaryText: "#000000",
      danger: "#ef4444",
      dangerHover: "#dc2626",
      dangerActive: "#b91c1c",
      dangerSubtle: "#450a0a",
      dangerLight: "#f87171",
      dangerText: "#ffffff",
    },
  },
  light: {
    name: "Light",
    colors: {
      background: "#f8fafc",
      surface: "#ffffff",
      surfaceHover: "#f1f5f9",
      border: "#cbd5e1",
      text: "#0f172a",
      textMuted: "#475569",
      textSubtle: "#94a3b8",
      textSecondary: "#334155",
      primary: "#0284c7",
      primaryHover: "#0369a1",
      primaryActive: "#075985",
      primarySubtle: "#e0f2fe",
      primaryLight: "#0ea5e9",
      primaryLighter: "#38bdf8",
      primaryText: "#ffffff",
      danger: "#dc2626",
      dangerHover: "#b91c1c",
      dangerActive: "#991b1b",
      dangerSubtle: "#fee2e2",
      dangerLight: "#ef4444",
      dangerText: "#ffffff",
    },
  },
  slate: {
    name: "Slate",
    colors: {
      background: "#020617",
      surface: "#0f172a",
      surfaceHover: "#1e293b",
      border: "#334155",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      textSubtle: "#64748b",
      textSecondary: "#cbd5e1",
      primary: "#38bdf8",
      primaryHover: "#0ea5e9",
      primaryActive: "#0284c7",
      primarySubtle: "#0c4a6e",
      primaryLight: "#7dd3fc",
      primaryLighter: "#bae6fd",
      primaryText: "#020617",
      danger: "#ef4444",
      dangerHover: "#dc2626",
      dangerActive: "#b91c1c",
      dangerSubtle: "#450a0a",
      dangerLight: "#f87171",
      dangerText: "#ffffff",
    },
  },
  midnight: {
    name: "Midnight",
    colors: {
      background: "#0d1117",
      surface: "#161b22",
      surfaceHover: "#21262d",
      border: "#30363d",
      text: "#e6edf3",
      textMuted: "#8b949e",
      textSubtle: "#6e7681",
      textSecondary: "#c9d1d9",
      primary: "#2f81f7",
      primaryHover: "#1f6feb",
      primaryActive: "#1158c7",
      primarySubtle: "#1f6feb33",
      primaryLight: "#5a9ffb",
      primaryLighter: "#79b8ff",
      primaryText: "#ffffff",
      danger: "#f85149",
      dangerHover: "#da3633",
      dangerActive: "#b62324",
      dangerSubtle: "#3d1214",
      dangerLight: "#ff7b72",
      dangerText: "#ffffff",
    },
  },
  dracula: {
    name: "Dracula",
    colors: {
      background: "#282a36",
      surface: "#21222c",
      surfaceHover: "#44475a",
      border: "#6272a4",
      text: "#f8f8f2",
      textMuted: "#9aacb8",
      textSubtle: "#6272a4",
      textSecondary: "#c5c8d6",
      primary: "#bd93f9",
      primaryHover: "#caa9fa",
      primaryActive: "#a67bef",
      primarySubtle: "#44475a",
      primaryLight: "#d4b8fa",
      primaryLighter: "#e0c8fb",
      primaryText: "#282a36",
      danger: "#ff5555",
      dangerHover: "#e84848",
      dangerActive: "#d63838",
      dangerSubtle: "#44475a",
      dangerLight: "#ff6e6e",
      dangerText: "#ffffff",
    },
  },
  nord: {
    name: "Nord",
    colors: {
      background: "#2e3440",
      surface: "#3b4252",
      surfaceHover: "#434c5e",
      border: "#4c566a",
      text: "#eceff4",
      textMuted: "#d8dee9",
      textSubtle: "#81a1c1",
      textSecondary: "#c8d0e0",
      primary: "#88c0d0",
      primaryHover: "#8fbcbb",
      primaryActive: "#81a1c1",
      primarySubtle: "#434c5e",
      primaryLight: "#a3cfd9",
      primaryLighter: "#b8dde3",
      primaryText: "#2e3440",
      danger: "#bf616a",
      dangerHover: "#a85159",
      dangerActive: "#8e424a",
      dangerSubtle: "#434c5e",
      dangerLight: "#d08770",
      dangerText: "#ffffff",
    },
  },
  solarized: {
    name: "Solarized",
    colors: {
      background: "#002b36",
      surface: "#073642",
      surfaceHover: "#094856",
      border: "#1a4a52",
      text: "#eee8d5",
      textMuted: "#93a1a1",
      textSubtle: "#657b83",
      textSecondary: "#c5c8b8",
      primary: "#268bd2",
      primaryHover: "#1e6fa8",
      primaryActive: "#185a8c",
      primarySubtle: "#073642",
      primaryLight: "#5aabd9",
      primaryLighter: "#8fc5e5",
      primaryText: "#002b36",
      danger: "#dc322f",
      dangerHover: "#cb4b16",
      dangerActive: "#a93a12",
      dangerSubtle: "#073642",
      dangerLight: "#e74c3c",
      dangerText: "#ffffff",
    },
  },
  monokai: {
    name: "Monokai",
    colors: {
      background: "#272822",
      surface: "#1e1f1c",
      surfaceHover: "#3e3d32",
      border: "#49483e",
      text: "#f8f8f2",
      textMuted: "#9a9a85",
      textSubtle: "#75715e",
      textSecondary: "#c8c8b8",
      primary: "#a6e22e",
      primaryHover: "#8ed026",
      primaryActive: "#75b016",
      primarySubtle: "#3e3d32",
      primaryLight: "#c0eb5e",
      primaryLighter: "#d3f08a",
      primaryText: "#272822",
      danger: "#f92672",
      dangerHover: "#e01666",
      dangerActive: "#c01256",
      dangerSubtle: "#3e3d32",
      dangerLight: "#ff5e9c",
      dangerText: "#ffffff",
    },
  },
  "tokyo-night": {
    name: "Tokyo Night",
    colors: {
      background: "#1a1b26",
      surface: "#16161e",
      surfaceHover: "#24283b",
      border: "#3b4261",
      text: "#c0caf5",
      textMuted: "#9aa5ce",
      textSubtle: "#565f89",
      textSecondary: "#b4c8e8",
      primary: "#7aa2f7",
      primaryHover: "#89b4fa",
      primaryActive: "#6198f5",
      primarySubtle: "#24283b",
      primaryLight: "#9abafb",
      primaryLighter: "#b3cbfb",
      primaryText: "#1a1b26",
      danger: "#f7768e",
      dangerHover: "#e66880",
      dangerActive: "#cc5a72",
      dangerSubtle: "#24283b",
      dangerLight: "#ff9bb0",
      dangerText: "#ffffff",
    },
  },
  gruvbox: {
    name: "Gruvbox",
    colors: {
      background: "#282828",
      surface: "#1d2021",
      surfaceHover: "#3c3836",
      border: "#504945",
      text: "#ebdbb2",
      textMuted: "#a89984",
      textSubtle: "#928374",
      textSecondary: "#d5c8a8",
      primary: "#fabd2f",
      primaryHover: "#d79921",
      primaryActive: "#b58815",
      primarySubtle: "#3c3836",
      primaryLight: "#fbd667",
      primaryLighter: "#fce49a",
      primaryText: "#282828",
      danger: "#fb4934",
      dangerHover: "#e03820",
      dangerActive: "#c0281a",
      dangerSubtle: "#3c3836",
      dangerLight: "#fb4934",
      dangerText: "#ffffff",
    },
  },
  catppuccin: {
    name: "Catppuccin",
    colors: {
      background: "#1e1e2e",
      surface: "#181825",
      surfaceHover: "#313244",
      border: "#45475a",
      text: "#cdd6f4",
      textMuted: "#a6adc8",
      textSubtle: "#7f849c",
      textSecondary: "#bac2dc",
      primary: "#cba6f7",
      primaryHover: "#b4befe",
      primaryActive: "#a78bdf",
      primarySubtle: "#313244",
      primaryLight: "#d9c2fa",
      primaryLighter: "#e6d6fc",
      primaryText: "#1e1e2e",
      danger: "#f38ba8",
      dangerHover: "#e6708f",
      dangerActive: "#cc5a72",
      dangerSubtle: "#313244",
      dangerLight: "#f38ba8",
      dangerText: "#ffffff",
    },
  },
  "rose-pine": {
    name: "Rose Pine",
    colors: {
      background: "#191724",
      surface: "#1f1d2e",
      surfaceHover: "#26233a",
      border: "#403d52",
      text: "#e0def4",
      textMuted: "#908caa",
      textSubtle: "#6e6a86",
      textSecondary: "#c5c2d4",
      primary: "#c4a7e7",
      primaryHover: "#ebbcba",
      primaryActive: "#b8a0d4",
      primarySubtle: "#26233a",
      primaryLight: "#d6c0ed",
      primaryLighter: "#e2d2f2",
      primaryText: "#191724",
      danger: "#eb6f92",
      dangerHover: "#d65a7e",
      dangerActive: "#c04a6a",
      dangerSubtle: "#26233a",
      dangerLight: "#eb6f92",
      dangerText: "#ffffff",
    },
  },
  onedark: {
    name: "One Dark",
    colors: {
      background: "#282c34",
      surface: "#21252b",
      surfaceHover: "#2c313c",
      border: "#3b4048",
      text: "#abb2bf",
      textMuted: "#7d8799",
      textSubtle: "#5c6370",
      textSecondary: "#9da5b8",
      primary: "#61afef",
      primaryHover: "#528bff",
      primaryActive: "#3d7ec9",
      primarySubtle: "#2c313c",
      primaryLight: "#8bc4f4",
      primaryLighter: "#aed4f8",
      primaryText: "#282c34",
      danger: "#e06c75",
      dangerHover: "#c95a63",
      dangerActive: "#b04a52",
      dangerSubtle: "#2c313c",
      dangerLight: "#e06c75",
      dangerText: "#ffffff",
    },
  },
};

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  background: "--color-dark-950",
  surface: "--color-dark-900",
  surfaceHover: "--color-dark-800",
  border: "--color-dark-700",
  text: "--color-white",
  textMuted: "--color-dark-400",
  textSubtle: "--color-dark-500",
  textSecondary: "--color-dark-300",
  primary: "--color-primary-500",
  primaryHover: "--color-primary-600",
  primaryActive: "--color-primary-700",
  primarySubtle: "--color-primary-800",
  primaryLight: "--color-primary-400",
  primaryLighter: "--color-primary-300",
  primaryText: "--color-primary-text",
  danger: "--color-danger-500",
  dangerHover: "--color-danger-600",
  dangerActive: "--color-danger-700",
  dangerSubtle: "--color-danger-800",
  dangerLight: "--color-danger-400",
  dangerText: "--color-danger-text",
};

export function applyTheme(theme: Theme) {
  const themeData = themes[theme];
  if (!themeData) return;
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = themeData.colors[key as keyof ThemeColors];
    if (value) root.style.setProperty(cssVar, value);
  }
}

interface ThemeState {
  currentTheme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  initTheme: () => Promise<void>;
}

const STORE_KEY = "settings.json";

export const useThemeStore = create<ThemeState>((set) => ({
  currentTheme: "dark",
  setTheme: async (theme) => {
    set({ currentTheme: theme });
    applyTheme(theme);
    try {
      const store = await load(STORE_KEY, { autoSave: false });
      await store.set("theme", theme);
      await store.save();
    } catch {
      localStorage.setItem("termvault.theme", theme);
    }
  },
  initTheme: async () => {
    let theme: Theme = "dark";
    try {
      const store = await load(STORE_KEY, { autoSave: false });
      const saved = await store.get<Theme>("theme");
      if (saved && themes[saved]) theme = saved;
    } catch {
      const saved = localStorage.getItem("termvault.theme") as Theme | null;
      if (saved && themes[saved]) theme = saved;
    }
    set({ currentTheme: theme });
    applyTheme(theme);
  },
}));
